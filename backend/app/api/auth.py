"""Auth routes - login, register."""
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.tenant import User, Tenant
from app.schemas.auth import Token, UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


@router.options("/login")
async def login_options():
    """CORS preflight for login."""
    return Response(status_code=200)


@router.post("/login")
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Login with email and password. Returns JWT."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(subject=str(user.id))
    return Token(access_token=token)


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
