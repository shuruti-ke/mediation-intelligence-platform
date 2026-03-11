"""User management - admin only. Onboard, view profiles, activate/deactivate."""
import uuid
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, and_

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.tenant import User, Tenant

router = APIRouter(prefix="/users", tags=["users"])

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

    class Config:
        from_attributes = True


class UserStatusUpdate(BaseModel):
    is_active: bool | None = None
    status: str | None = None  # pending, active, inactive


class ReassignMediator(BaseModel):
    mediator_id: uuid.UUID
    reason: str | None = None  # conflict_of_interest, user_request, workload, other
    note: str | None = None
    notify_user_and_mediator: bool = True


@router.get("", response_model=list[UserResponse])
async def list_users(
    role: str | None = Query(None, description="Filter by role: mediator, client_individual, client_corporate"),
    status: str | None = Query(None, description="Filter by status: pending, active, inactive"),
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
    q = q.order_by(User.created_at.desc())
    result = await db.execute(q)
    users = result.scalars().all()
    return [
        UserResponse(
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
        )
        for u in users
    ]


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
    )


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


@router.post("/intake", response_model=UserResponse)
async def create_user_intake(
    data: UserIntakeMinimal,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """Stage 1: Create user with minimal intake. Auto-assign or invite."""
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

    # Auto-assign mediator
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


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user_status(
    user_id: uuid.UUID,
    data: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """Activate or deactivate a user."""
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
        assigned_mediator_id=str(u.assigned_mediator_id) if getattr(u, "assigned_mediator_id", None) else None,
    )


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
