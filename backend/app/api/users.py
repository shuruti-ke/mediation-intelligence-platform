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

router = APIRouter(prefix="/users", tags=["users"])


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


class ReassignMediator(BaseModel):
    mediator_id: uuid.UUID
    reason: str | None = None  # conflict_of_interest, user_request, workload, other
    note: str | None = None
    notify_user_and_mediator: bool = True


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


@router.get("/{user_id}/cases")
async def get_user_cases(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get cases where the user is a party. Mediators can only see cases for their assigned clients."""
    # Mediators: only their assigned clients
    if user.role in ("mediator", "trainee"):
        client = await db.get(User, user_id)
        if not client or client.assigned_mediator_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    result = await db.execute(
        select(Case)
        .join(CaseParty, CaseParty.case_id == Case.id)
        .where(CaseParty.user_id == user_id)
        .order_by(Case.updated_at.desc().nullslast(), Case.created_at.desc())
    )
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
    """List users pending admin approval."""
    qry = select(User).where(User.role != "super_admin")
    if user.tenant_id:
        qry = qry.where(User.tenant_id == user.tenant_id)
    qry = qry.where(User.approval_status == "pending_approval")
    qry = qry.order_by(User.created_at.desc())
    result = await db.execute(qry)
    users = result.scalars().all()
    return [_user_to_response(u) for u in users]


@router.get("", response_model=list[UserResponse])
async def list_users(
    role: str | None = Query(None, description="Filter by role: mediator, client_individual, client_corporate"),
    status: str | None = Query(None, description="Filter by status: pending, active, inactive"),
    search: str | None = Query(None, description="Search by name, email, user_id"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """List users. Super-admin sees all; others filtered by tenant."""
    q = select(User).where(User.role != "super_admin")
    if user.role != "super_admin" and user.tenant_id:
        q = q.where(User.tenant_id == user.tenant_id)
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
    q = q.order_by(User.created_at.desc()).offset(skip).limit(limit)
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
    if getattr(u, "approval_status", None) != "pending_approval":
        raise HTTPException(status_code=400, detail="User is not pending approval")
    country = (getattr(u, "country", None) or "KE").upper()[:2]
    u.user_id = await _generate_user_id(db, country)
    u.approval_status = "approved"
    u.approval_rejection_reason = None
    u.status = "active"
    u.is_active = True
    u.onboarded_at = datetime.utcnow()
    await db.flush()
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
    if getattr(u, "approval_status", None) != "pending_approval":
        raise HTTPException(status_code=400, detail="User is not pending approval")
    u.approval_status = "rejected"
    u.approval_rejection_reason = data.reason
    await db.flush()
    await db.refresh(u)
    return _user_to_response(u)


async def _assign_mediator(db: AsyncSession, tenant_id: uuid.UUID | None) -> uuid.UUID | None:
    """Auto-assign mediator by workload. Returns mediator_id or None."""
    q = select(User).where(
        User.role.in_(["mediator", "trainee"]),
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
    )
    db.add(new_user)
    await db.flush()
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
    if data.is_active is not None:
        u.is_active = data.is_active
    if data.status is not None:
        u.status = data.status
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

    mres = await db.execute(select(User).where(and_(User.id == data.mediator_id, User.role.in_(["mediator", "trainee"]))))
    if not mres.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Invalid mediator")

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
