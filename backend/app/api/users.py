"""User management - admin only. Onboard, view profiles, activate/deactivate."""
import uuid
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, and_, or_

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.tenant import User, Tenant
from app.models.case import Case, CaseParty
from app.models.notification import InAppNotification

router = APIRouter(prefix="/users", tags=["users"])


async def _create_notification(db: AsyncSession, user_id: uuid.UUID, title: str, body: str | None, ntype: str, link: str | None = None):
    """Create in-app notification for a user."""
    n = InAppNotification(user_id=user_id, title=title, body=body, type=ntype, link=link)
    db.add(n)


async def _notify_admins_pending_approval(db: AsyncSession, tenant_id: uuid.UUID | None, client_name: str, client_id: uuid.UUID):
    """Notify all super_admins in tenant about new pending approval."""
    q = select(User).where(User.role == "super_admin")
    if tenant_id:
        q = q.where(User.tenant_id == tenant_id)
    result = await db.execute(q)
    admins = result.scalars().all()
    for admin in admins:
        await _create_notification(
            db, admin.id,
            "New client pending approval",
            f"{client_name} has been submitted for approval.",
            "approval_pending",
            f"/admin?tab=approvals",
        )


async def _generate_user_id(db: AsyncSession, country: str = "KE") -> str:
    """Generate USR-{COUNTRY}-{YEAR}-{SEQ}."""
    year = datetime.utcnow().year
    prefix = f"USR-{country}-{year}-"
    result = await db.execute(
        select(func.count(User.id)).where(User.user_id.like(f"{prefix}%"))
    )
    count = result.scalar() or 0
    return f"{prefix}{count + 1:04d}"

# Country codes for phone (Africa-first)
COMMON_COUNTRY_CODES = {"KE": "+254", "NG": "+234", "ZA": "+27", "GH": "+233", "TZ": "+255", "UG": "+256"}


class UserOnboard(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None
    role: str  # mediator, client_individual, client_corporate


class UserIntakeMinimal(BaseModel):
    """Stage 1: Minimal intake - required for account creation."""
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(..., min_length=8, max_length=25)
    user_type: str = Field(..., pattern="^(individual|corporate)$")
    country: str = Field(..., min_length=2, max_length=10)
    password: str | None = None
    invite_via_link: bool = False


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str | None
    role: str
    status: str
    is_active: bool
    onboarded_at: str | None
    last_login_at: str | None
    created_at: str
    phone: str | None = None
    country: str | None = None
    assigned_mediator_id: str | None = None
    user_id: str | None = None
    approval_status: str | None = None

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    display_name: str | None = None
    email: str | None = None
    phone: str | None = None
    country: str | None = None
    assigned_mediator_id: uuid.UUID | None = None
    is_active: bool | None = None
    status: str | None = None


class ApproveReject(BaseModel):
    reason: str | None = None


class RequestInfo(BaseModel):
    notes: str = Field(..., min_length=1, max_length=500)


def _user_to_response(u: User) -> UserResponse:
    return UserResponse(
        id=str(u.id),
        email=u.email,
        display_name=u.display_name,
        role=u.role,
        status=getattr(u, "status", "active") or "active",
        is_active=u.is_active,
        onboarded_at=u.onboarded_at.isoformat() if getattr(u, "onboarded_at", None) else None,
        last_login_at=u.last_login_at.isoformat() if getattr(u, "last_login_at", None) else None,
        created_at=u.created_at.isoformat(),
        phone=getattr(u, "phone", None),
        country=getattr(u, "country", None),
        assigned_mediator_id=str(u.assigned_mediator_id) if getattr(u, "assigned_mediator_id", None) else None,
        user_id=getattr(u, "user_id", None),
        approval_status=getattr(u, "approval_status", None),
    )


class UserStatusUpdate(BaseModel):
    is_active: bool | None = None
    status: str | None = None  # pending, active, inactive
    display_name: str | None = None
    email: str | None = None
    phone: str | None = None
    country: str | None = None
    assigned_mediator_id: uuid.UUID | None = None
    deactivation_reason: str | None = None  # inactive_user, policy_violation, user_requested, other


class ReassignMediator(BaseModel):
    mediator_id: uuid.UUID
    reason: str | None = None  # conflict_of_interest, user_request, workload, other
    note: str | None = None
    notify_user_and_mediator: bool = True


@router.get("/my-submitted-clients", response_model=list[UserResponse])
async def list_my_submitted_clients(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("mediator", "trainee")),
):
    """List clients submitted by current mediator (pending, on_hold, rejected) for resubmit flow."""
    q = select(User).where(User.submitted_by_id == user.id)
    q = q.where(User.role.in_(["client_individual", "client_corporate"]))
    q = q.where(User.approval_status.in_(["pending_approval", "on_hold", "rejected"]))
    q = q.order_by(User.created_at.desc())
    result = await db.execute(q)
    users = result.scalars().all()
    return [_user_to_response(u) for u in users]


@router.get("/my-clients", response_model=list[UserResponse])
async def list_my_clients(
    search: str | None = Query(None, description="Search by name, email, user_id"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("mediator", "trainee")),
):
    """List clients assigned to the current mediator."""
    q = select(User).where(User.assigned_mediator_id == user.id)
    q = q.where(User.role.in_(["client_individual", "client_corporate"]))
    if search and len(search.strip()) >= 2:
        term = f"%{search.strip()}%"
        conds = [User.email.ilike(term), User.display_name.ilike(term)]
        if hasattr(User, "user_id"):
            conds.append(User.user_id.ilike(term))
        if hasattr(User, "phone"):
            conds.append(User.phone.ilike(term))
        q = q.where(or_(*conds))
    q = q.order_by(User.display_name.asc()).offset(skip).limit(limit)
    result = await db.execute(q)
    users = result.scalars().all()
    return [_user_to_response(u) for u in users]


@router.get("/me/dashboard")
async def get_my_client_dashboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Client dashboard: cases, bookings, mediator. Clients only."""
    if user.role not in ("client_corporate", "client_individual"):
        raise HTTPException(status_code=403, detail="Client dashboard only")
    # Cases
    client_user_id_str = getattr(user, "user_id", None)
    conditions = [Case.id.in_(select(CaseParty.case_id).where(CaseParty.user_id == user.id))]
    if client_user_id_str:
        conditions.append(Case.internal_reference == client_user_id_str)
    cases_q = select(Case).where(or_(*conditions)).order_by(Case.updated_at.desc().nullslast(), Case.created_at.desc()).limit(20)
    cases_result = await db.execute(cases_q)
    my_cases = cases_result.scalars().unique().all()
    # Bookings (from calendar)
    from app.models.calendar import CalendarBooking
    from datetime import date
    today = date.today()
    bookings_q = select(CalendarBooking).where(
        CalendarBooking.client_id == user.id,
        CalendarBooking.slot_date >= today,
        CalendarBooking.status == "scheduled",
    ).order_by(CalendarBooking.slot_date, CalendarBooking.start_time).limit(10)
    bookings_result = await db.execute(bookings_q)
    my_bookings = bookings_result.scalars().all()
    # Mediator
    mediator = None
    if getattr(user, "assigned_mediator_id", None):
        m = await db.get(User, user.assigned_mediator_id)
        if m:
            mediator = {"display_name": m.display_name or m.email, "email": m.email}
    return {
        "user": {"display_name": user.display_name, "email": user.email, "user_id": getattr(user, "user_id", None)},
        "mediator": mediator,
        "cases": [
            {"id": str(c.id), "case_number": c.case_number, "title": c.title, "status": c.status, "case_type": c.case_type or c.dispute_category}
            for c in my_cases
        ],
        "bookings": [
            {"id": str(b.id), "slot_date": b.slot_date.isoformat(), "start_time": b.start_time.strftime("%H:%M"), "end_time": b.end_time.strftime("%H:%M"), "meeting_type": b.meeting_type}
            for b in my_bookings
        ],
    }


@router.get("/{user_id}/cases")
async def get_user_cases(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get cases linked to the client: by CaseParty.user_id or Case.internal_reference = client.user_id."""
    if user.role in ("mediator", "trainee"):
        client = await db.get(User, user_id)
        if not client or client.assigned_mediator_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role in ("client_corporate", "client_individual"):
        if user_id != user.id:
            raise HTTPException(status_code=403, detail="You can only view your own cases")
    client_obj = await db.get(User, user_id)
    client_user_id_str = getattr(client_obj, "user_id", None) if client_obj else None
    # Cases linked via CaseParty.user_id OR Case.internal_reference = client's user_id (e.g. USR-KE-2026-0001)
    conditions = [Case.id.in_(select(CaseParty.case_id).where(CaseParty.user_id == user_id))]
    if client_user_id_str:
        conditions.append(Case.internal_reference == client_user_id_str)
    q = select(Case).where(or_(*conditions)).order_by(
        Case.updated_at.desc().nullslast(), Case.created_at.desc()
    )
    result = await db.execute(q)
    cases = result.scalars().unique().all()
    return [
        {
            "id": str(c.id),
            "case_number": c.case_number,
            "title": c.title,
            "status": c.status,
            "case_type": c.case_type or c.dispute_category,
            "priority_level": c.priority_level,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in cases
    ]


@router.get("/search", response_model=list[UserResponse])
async def search_users(
    q: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """Search users by user_id (exact), name, email, phone (partial)."""
    term = f"%{q.strip()}%"
    exact_term = q.strip()
    qry = select(User).where(User.role != "super_admin")
    if user.tenant_id:
        qry = qry.where(User.tenant_id == user.tenant_id)
    qry = qry.where(
        or_(
            User.user_id == exact_term,
            User.email.ilike(term),
            User.display_name.ilike(term),
            User.phone.ilike(term),
        )
    )
    qry = qry.order_by(User.display_name.asc()).limit(limit)
    result = await db.execute(qry)
    users = result.scalars().all()
    return [_user_to_response(u) for u in users]


@router.get("/pending-approvals", response_model=list[UserResponse])
async def list_pending_approvals(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """List users pending admin approval (includes on_hold)."""
    qry = select(User).where(User.role != "super_admin")
    if user.tenant_id:
        qry = qry.where(User.tenant_id == user.tenant_id)
    qry = qry.where(User.approval_status.in_(["pending_approval", "on_hold"]))
    qry = qry.order_by(User.created_at.desc())
    result = await db.execute(qry)
    users = result.scalars().all()
    return [_user_to_response(u) for u in users]


@router.get("", response_model=list[UserResponse])
async def list_users(
    role: str | None = Query(None, description="Filter by role: mediator, client_individual, client_corporate, trainee"),
    status: str | None = Query(None, description="Filter by status: pending, active, inactive"),
    search: str | None = Query(None, description="Search by name, email, user_id"),
    sort: str | None = Query("created_at", description="Sort: name_asc, name_desc, created_at, last_active"),
    date_from: str | None = Query(None, description="Filter created_at >= YYYY-MM-DD"),
    date_to: str | None = Query(None, description="Filter created_at <= YYYY-MM-DD"),
    include_deleted: bool = Query(False, description="Include soft-deleted users"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """List users. Super-admin sees all; others filtered by tenant. Pagination 50 per page."""
    q = select(User).where(User.role != "super_admin")
    if user.role != "super_admin" and user.tenant_id:
        q = q.where(User.tenant_id == user.tenant_id)
    if not include_deleted:
        q = q.where(User.deleted_at.is_(None))
    if role:
        q = q.where(User.role == role)
    if status:
        q = q.where(User.status == status)
    if search and len(search.strip()) >= 2:
        term = f"%{search.strip()}%"
        conds = [User.email.ilike(term), User.display_name.ilike(term)]
        if hasattr(User, "user_id"):
            conds.append(User.user_id.ilike(term))
        if hasattr(User, "phone"):
            conds.append(User.phone.ilike(term))
        q = q.where(or_(*conds))
    if date_from:
        try:
            from datetime import datetime
            dt = datetime.strptime(date_from, "%Y-%m-%d")
            q = q.where(User.created_at >= dt)
        except ValueError:
            pass
    if date_to:
        try:
            from datetime import datetime
            dt = datetime.strptime(date_to, "%Y-%m-%d")
            q = q.where(User.created_at <= dt)
        except ValueError:
            pass
    if sort == "name_asc":
        q = q.order_by(User.display_name.asc().nullslast(), User.email.asc())
    elif sort == "name_desc":
        q = q.order_by(User.display_name.desc().nullslast(), User.email.desc())
    elif sort == "last_active":
        q = q.order_by(User.last_login_at.desc().nullslast(), User.created_at.desc())
    else:
        q = q.order_by(User.created_at.desc())
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    users = result.scalars().all()
    return [_user_to_response(u) for u in users]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """Get user profile."""
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if user.tenant_id and u.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _user_to_response(u)


@router.post("/{user_id}/approve", response_model=UserResponse)
async def approve_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role("super_admin")),
):
    """Approve pending user: generate user_id, activate account."""
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if admin.tenant_id and u.tenant_id != admin.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if getattr(u, "approval_status", None) not in ("pending_approval", "on_hold"):
        raise HTTPException(status_code=400, detail="User is not pending approval")
    country = (getattr(u, "country", None) or "KE").upper()[:2]
    u.user_id = await _generate_user_id(db, country)
    u.approval_status = "approved"
    u.approval_rejection_reason = None
    u.approval_notes = None
    u.status = "active"
    u.is_active = True
    u.onboarded_at = datetime.utcnow()
    u.must_change_password = True
    # Assign submitting mediator to client if not already assigned
    if getattr(u, "submitted_by_id", None) and not u.assigned_mediator_id:
        u.assigned_mediator_id = u.submitted_by_id
    await db.flush()
    await _create_notification(
        db, u.id,
        "Welcome to the Mediation Platform",
        f"Your account has been approved. Your User ID is: {u.user_id}. Please log in and change your password.",
        "approval_approved",
        "/login",
    )
    await db.refresh(u)
    return _user_to_response(u)


@router.post("/{user_id}/reject", response_model=UserResponse)
async def reject_user(
    user_id: uuid.UUID,
    data: ApproveReject,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role("super_admin")),
):
    """Reject pending user with reason."""
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if admin.tenant_id and u.tenant_id != admin.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if getattr(u, "approval_status", None) not in ("pending_approval", "on_hold"):
        raise HTTPException(status_code=400, detail="User is not pending approval")
    u.approval_status = "rejected"
    u.approval_rejection_reason = data.reason
    u.approval_notes = None
    await db.flush()
    # Notify submitting mediator
    submitted_by = getattr(u, "submitted_by_id", None)
    if submitted_by:
        reason_text = data.reason or "No reason provided"
        await _create_notification(
            db, submitted_by,
            "Client approval rejected",
            f"{u.display_name or u.email} was not approved. Reason: {reason_text}",
            "approval_rejected",
            "/dashboard",
        )
    await db.refresh(u)
    return _user_to_response(u)


@router.post("/{user_id}/request-info", response_model=UserResponse)
async def request_info_user(
    user_id: uuid.UUID,
    data: RequestInfo,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role("super_admin")),
):
    """Put pending user on hold and notify mediator to provide more info."""
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if admin.tenant_id and u.tenant_id != admin.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if getattr(u, "approval_status", None) != "pending_approval":
        raise HTTPException(status_code=400, detail="User is not pending approval")
    u.approval_status = "on_hold"
    u.approval_notes = data.notes
    await db.flush()
    submitted_by = getattr(u, "submitted_by_id", None)
    if submitted_by:
        await _create_notification(
            db, submitted_by,
            "More info needed for client approval",
            f"Admin requested more information for {u.display_name or u.email}: {data.notes}",
            "approval_on_hold",
            "/dashboard",
        )
    await db.refresh(u)
    return _user_to_response(u)


@router.post("/{user_id}/resubmit", response_model=UserResponse)
async def resubmit_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("mediator", "trainee", "super_admin")),
):
    """Resubmit rejected client for approval. Mediator can only resubmit their own submissions."""
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if u.tenant_id and user.tenant_id and u.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if getattr(u, "approval_status", None) != "rejected":
        raise HTTPException(status_code=400, detail="Only rejected users can be resubmitted")
    if user.role in ("mediator", "trainee") and getattr(u, "submitted_by_id", None) != user.id:
        raise HTTPException(status_code=403, detail="You can only resubmit clients you submitted")
    u.approval_status = "pending_approval"
    u.approval_rejection_reason = None
    u.approval_notes = None
    u.submitted_by_id = user.id if user.role in ("mediator", "trainee") else u.submitted_by_id
    await db.flush()
    await _notify_admins_pending_approval(db, u.tenant_id, u.display_name or u.email, u.id)
    await db.refresh(u)
    return _user_to_response(u)


async def _assign_mediator(db: AsyncSession, tenant_id: uuid.UUID | None) -> uuid.UUID | None:
    """Auto-assign mediator by workload. Returns mediator_id or None. Excludes trainees."""
    q = select(User).where(
        User.role == "mediator",
        User.is_active == True,
    )
    if tenant_id:
        q = q.where(User.tenant_id == tenant_id)
    result = await db.execute(q)
    mediators = result.scalars().all()
    if not mediators:
        return None
    # Simple workload: assign to mediator with fewest assigned clients
    client_count = {}
    for m in mediators:
        cq = select(func.count(User.id)).where(User.assigned_mediator_id == m.id)
        cr = await db.execute(cq)
        client_count[m.id] = cr.scalar() or 0
    best = min(mediators, key=lambda m: client_count.get(m.id, 0))
    return best.id


@router.post("/onboard-client", response_model=UserResponse)
async def mediator_onboard_client(
    data: UserIntakeMinimal,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator", "trainee")),
):
    """Mediator initiates client onboarding. Creates pending_approval; admin must approve."""
    if data.invite_via_link and data.password:
        raise HTTPException(status_code=400, detail="Use either password or invite link, not both")
    if not data.invite_via_link and not data.password:
        raise HTTPException(status_code=400, detail="Provide password or select invite via link")

    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    tenant_id = user.tenant_id
    if not tenant_id:
        t = (await db.execute(select(Tenant).limit(1))).scalar_one_or_none()
        tenant_id = t.id if t else None

    role = "client_individual" if data.user_type == "individual" else "client_corporate"
    password = get_password_hash(data.password) if data.password else get_password_hash(secrets.token_urlsafe(16))

    new_user = User(
        email=data.email,
        hashed_password=password,
        display_name=data.full_name,
        role=role,
        tenant_id=tenant_id,
        phone=data.phone,
        country=data.country.upper()[:2],
        is_active=False,
        status="pending",
        onboarded_at=None,
        approval_status="pending_approval",
        submitted_by_id=user.id,
    )
    db.add(new_user)
    await db.flush()
    await _notify_admins_pending_approval(db, tenant_id, data.full_name or data.email, new_user.id)
    await db.refresh(new_user)
    return _user_to_response(new_user)


@router.post("/intake", response_model=UserResponse)
async def create_user_intake(
    data: UserIntakeMinimal,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """Stage 1: Create user with minimal intake. Admin bypasses approval; user_id generated."""
    if data.invite_via_link and data.password:
        raise HTTPException(status_code=400, detail="Use either password or invite link, not both")
    if not data.invite_via_link and not data.password:
        raise HTTPException(status_code=400, detail="Provide password or select invite via link")

    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    tenant_id = user.tenant_id
    if not tenant_id:
        t = (await db.execute(select(Tenant).limit(1))).scalar_one_or_none()
        tenant_id = t.id if t else None

    role = "client_individual" if data.user_type == "individual" else "client_corporate"
    password = get_password_hash(data.password) if data.password else get_password_hash(secrets.token_urlsafe(16))

    new_user = User(
        email=data.email,
        hashed_password=password,
        display_name=data.full_name,
        role=role,
        tenant_id=tenant_id,
        phone=data.phone,
        country=data.country.upper()[:2],
        is_active=True,
        status="pending" if data.invite_via_link else "active",
        onboarded_at=datetime.utcnow() if not data.invite_via_link else None,
    )
    db.add(new_user)
    await db.flush()

    # Admin-created: generate user_id immediately
    country = (data.country or "KE").upper()[:2]
    new_user.user_id = await _generate_user_id(db, country)
    new_user.approval_status = "approved"

    # Auto-assign mediator (clients only)
    mediator_id = await _assign_mediator(db, tenant_id)
    if mediator_id:
        new_user.assigned_mediator_id = mediator_id
        try:
            await db.execute(text(
                "INSERT INTO mediator_assignments (user_id, mediator_id, assigned_by_id, reason) VALUES (:uid, :mid, :bid, :reason)"
            ), {"uid": new_user.id, "mid": mediator_id, "bid": user.id, "reason": "auto_onboarding"})
        except Exception:
            pass

    if data.invite_via_link:
        token = secrets.token_urlsafe(32)
        expires = datetime.utcnow() + timedelta(days=7)
        try:
            await db.execute(text("""
                INSERT INTO invite_tokens (email, token, role, tenant_id, expires_at, created_by_id)
                VALUES (:email, :token, :role, :tid, :expires, :cid)
            """), {"email": data.email, "token": token, "role": role, "tid": tenant_id, "expires": expires, "cid": user.id})
        except Exception:
            pass  # Table may not exist yet

    await db.flush()
    await db.refresh(new_user)

    return UserResponse(
        id=str(new_user.id),
        email=new_user.email,
        display_name=new_user.display_name,
        role=new_user.role,
        status=new_user.status,
        is_active=new_user.is_active,
        onboarded_at=new_user.onboarded_at.isoformat() if new_user.onboarded_at else None,
        last_login_at=None,
        created_at=new_user.created_at.isoformat(),
        phone=new_user.phone,
        country=new_user.country,
        assigned_mediator_id=str(new_user.assigned_mediator_id) if new_user.assigned_mediator_id else None,
    )


@router.post("", response_model=UserResponse)
async def onboard_user(
    data: UserOnboard,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """Onboard a new mediator or client."""
    if data.role not in ("mediator", "trainee", "client_individual", "client_corporate"):
        raise HTTPException(status_code=400, detail="Invalid role")
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    tenant_id = user.tenant_id
    if not tenant_id:
        t = (await db.execute(select(Tenant).limit(1))).scalar_one_or_none()
        tenant_id = t.id if t else None
    new_user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        display_name=data.display_name or data.email.split("@")[0],
        role=data.role,
        tenant_id=tenant_id,
        is_active=True,
        status="active",
        onboarded_at=datetime.utcnow(),
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)
    return UserResponse(
        id=str(new_user.id),
        email=new_user.email,
        display_name=new_user.display_name,
        role=new_user.role,
        status=new_user.status,
        is_active=new_user.is_active,
        onboarded_at=new_user.onboarded_at.isoformat() if new_user.onboarded_at else None,
        last_login_at=None,
        created_at=new_user.created_at.isoformat(),
        phone=getattr(new_user, "phone", None),
        country=getattr(new_user, "country", None),
        assigned_mediator_id=str(new_user.assigned_mediator_id) if getattr(new_user, "assigned_mediator_id", None) else None,
    )


class MediatorClientProfileUpdate(BaseModel):
    display_name: str | None = None
    phone: str | None = None
    email: str | None = None
    country: str | None = None


@router.get("/{user_id}/profile", response_model=UserResponse)
async def get_client_profile_for_mediator(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("mediator", "trainee", "super_admin")),
):
    """Mediator gets their assigned client's profile. Super_admin can view any client."""
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role in ("mediator", "trainee") and u.assigned_mediator_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if u.role not in ("client_individual", "client_corporate"):
        raise HTTPException(status_code=403, detail="Not a client")
    return _user_to_response(u)


@router.patch("/{user_id}/profile", response_model=UserResponse)
async def update_client_profile_by_mediator(
    user_id: uuid.UUID,
    data: MediatorClientProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("mediator", "trainee", "super_admin")),
):
    """Mediator updates their assigned client's profile (display_name, phone, email, country)."""
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role in ("mediator", "trainee") and u.assigned_mediator_id != user.id:
        raise HTTPException(status_code=403, detail="You can only edit clients assigned to you")
    if u.role not in ("client_individual", "client_corporate"):
        raise HTTPException(status_code=403, detail="Can only edit client profiles")
    if data.display_name is not None:
        u.display_name = data.display_name
    if data.phone is not None:
        u.phone = data.phone
    if data.email is not None:
        u.email = data.email
    if data.country is not None:
        u.country = data.country.upper()[:2]
    await db.flush()
    await db.refresh(u)
    return _user_to_response(u)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user_status(
    user_id: uuid.UUID,
    data: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """Update user profile and status."""
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if user.tenant_id and u.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if getattr(u, "deleted_at", None):
        raise HTTPException(status_code=400, detail="Cannot update soft-deleted user")
    if data.is_active is not None:
        u.is_active = data.is_active
    if data.status is not None:
        u.status = data.status
    if data.deactivation_reason is not None:
        u.deactivation_reason = data.deactivation_reason
    if data.display_name is not None:
        u.display_name = data.display_name
    if data.email is not None:
        u.email = data.email
    if data.phone is not None:
        u.phone = data.phone
    if data.country is not None:
        u.country = data.country.upper()[:2]
    if data.assigned_mediator_id is not None:
        if u.role in ("client_individual", "client_corporate"):
            u.assigned_mediator_id = data.assigned_mediator_id
        else:
            u.assigned_mediator_id = None
    await db.flush()
    await db.refresh(u)
    return _user_to_response(u)


@router.post("/{user_id}/soft-delete", response_model=UserResponse)
async def soft_delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role("super_admin")),
):
    """Soft delete user. Sets deleted_at, is_active=False. User cannot login."""
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if admin.tenant_id and u.tenant_id != admin.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    u.deleted_at = datetime.utcnow()
    u.is_active = False
    u.status = "inactive"
    await db.flush()
    await db.refresh(u)
    return _user_to_response(u)


@router.post("/{user_id}/reassign-mediator", response_model=UserResponse)
async def reassign_mediator(
    user_id: uuid.UUID,
    data: ReassignMediator,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role("super_admin")),
):
    """Reassign user to a different mediator. Audit logged."""
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if admin.tenant_id and u.tenant_id != admin.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")

    mres = await db.execute(select(User).where(and_(User.id == data.mediator_id, User.role == "mediator")))
    if not mres.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Invalid mediator (must be an active mediator, not a trainee)")

    u.assigned_mediator_id = data.mediator_id
    try:
        await db.execute(text(
            "INSERT INTO mediator_assignments (user_id, mediator_id, assigned_by_id, reason, note) VALUES (:uid, :mid, :bid, :reason, :note)"
        ), {"uid": u.id, "mid": data.mediator_id, "bid": admin.id, "reason": data.reason or "reassignment", "note": data.note})
    except Exception:
        pass

    await db.flush()
    await db.refresh(u)
    return UserResponse(
        id=str(u.id),
        email=u.email,
        display_name=u.display_name,
        role=u.role,
        status=getattr(u, "status", "active") or "active",
        is_active=u.is_active,
        onboarded_at=u.onboarded_at.isoformat() if getattr(u, "onboarded_at", None) else None,
        last_login_at=u.last_login_at.isoformat() if getattr(u, "last_login_at", None) else None,
        created_at=u.created_at.isoformat(),
        phone=getattr(u, "phone", None),
        country=getattr(u, "country", None),
        assigned_mediator_id=str(u.assigned_mediator_id) if u.assigned_mediator_id else None,
    )
