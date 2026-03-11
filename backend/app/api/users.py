"""User management - admin only. Onboard, view profiles, activate/deactivate."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.tenant import User, Tenant

router = APIRouter(prefix="/users", tags=["users"])


class UserOnboard(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None
    role: str  # mediator, client_individual, client_corporate


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

    class Config:
        from_attributes = True


class UserStatusUpdate(BaseModel):
    is_active: bool | None = None
    status: str | None = None  # pending, active, inactive


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
    )
