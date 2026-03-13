"""Auth routes - login, register."""
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.tenant import User, Tenant
from app.schemas.auth import Token, UserCreate, UserResponse, LoginResponse, LoginUserInfo

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.options("/login")
async def login_options():
    """CORS preflight for login."""
    return Response(status_code=200)


@router.post("/login", response_model=LoginResponse)
async def login(
    data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Login with email and password. Returns JWT and user info for role-based redirect."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    if getattr(user, "deleted_at", None):
        raise HTTPException(status_code=403, detail="Account has been deleted")
    from datetime import datetime
    user.last_login_at = datetime.utcnow()
    if getattr(user, "status", None) == "pending":
        user.status = "active"
    await db.flush()
    from app.services.audit import log_audit
    await log_audit(db, "LOGIN", "user", str(user.id), tenant_id=user.tenant_id, user_id=user.id, request=request)
    token = create_access_token(subject=str(user.id))
    return LoginResponse(
        access_token=token,
        user=LoginUserInfo(
            id=str(user.id),
            email=user.email,
            role=user.role,
            display_name=user.display_name,
            must_change_password=getattr(user, "must_change_password", False),
        ),
    )


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Change password. Required on first login when must_change_password is set."""
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    user.hashed_password = get_password_hash(data.new_password)
    user.must_change_password = False
    await db.flush()
    from app.services.audit import log_audit
    await log_audit(db, "PASSWORD_CHANGE", "user", str(user.id), tenant_id=user.tenant_id, user_id=user.id, request=request)
    return {"message": "Password changed successfully"}


class ImpersonateRequest(BaseModel):
    target_user_id: str


@router.post("/impersonate")
async def impersonate_user(
    data: ImpersonateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role("super_admin")),
):
    """Super-admin only. Returns access token for target user to act as them."""
    result = await db.execute(select(User).where(User.id == UUID(data.target_user_id)))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if admin.tenant_id and target.tenant_id != admin.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if getattr(target, "deleted_at", None):
        raise HTTPException(status_code=400, detail="Cannot impersonate deleted user")
    if not target.is_active:
        raise HTTPException(status_code=400, detail="Cannot impersonate inactive user")
    from datetime import timedelta
    from app.services.audit import log_audit
    await log_audit(db, "IMPERSONATE", "user", str(target.id), tenant_id=admin.tenant_id, user_id=admin.id, request=request, metadata={"target_email": target.email})
    token = create_access_token(subject=str(target.id), expires_delta=timedelta(hours=1))
    return {
        "access_token": token,
        "user": {
            "id": str(target.id),
            "email": target.email,
            "role": target.role,
            "display_name": target.display_name,
            "must_change_password": False,
        },
    }


@router.get("/me", response_model=LoginUserInfo)
async def get_current_user_info(
    user: User = Depends(get_current_user),
) -> LoginUserInfo:
    """Get current user info. Used for role-based routing on page load."""
    return LoginUserInfo(
        id=str(user.id),
        email=user.email,
        role=user.role,
        display_name=user.display_name,
        must_change_password=getattr(user, "must_change_password", False),
    )


@router.post("/register", response_model=UserResponse)
async def register(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Register new user. Super-admin can create without tenant."""
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    tenant_id = None
    if data.tenant_id:
        try:
            tenant_id = UUID(data.tenant_id) if data.tenant_id != "new" else None
        except ValueError:
            tenant_id = None

    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        display_name=data.display_name,
        role=data.role,
        tenant_id=tenant_id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user
