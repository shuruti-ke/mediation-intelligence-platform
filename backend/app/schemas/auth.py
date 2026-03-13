"""Auth schemas."""
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginUserInfo(BaseModel):
    id: str
    email: str
    role: str
    display_name: str | None
    must_change_password: bool = False


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: LoginUserInfo


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None
    role: str
    tenant_id: str | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str | None
    role: str
    tenant_id: str | None

    class Config:
        from_attributes = True

    @classmethod
    def from_user(cls, user):
        return cls(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
        )
