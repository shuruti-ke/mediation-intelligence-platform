"""JWT and password hashing."""
from datetime import datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload.get("sub")
    except JWTError:
        return None


def create_jitsi_jwt(
    room_name: str,
    user_id: str,
    display_name: str,
    moderator: bool = False,
    expires_minutes: int = 120,
) -> str | None:
    """Create JWT for Jitsi/JaaS room access. Returns None if JaaS not configured."""
    if not settings.jitsi_app_id or not settings.jitsi_app_secret:
        return None
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=expires_minutes)
    sub = settings.jitsi_app_id
    if not sub.startswith("vpaas-magic-cookie-"):
        sub = f"vpaas-magic-cookie-{sub}"
    payload = {
        "aud": "jitsi",
        "iss": "chat",
        "sub": sub,
        "room": room_name,
        "exp": int(exp.timestamp()),
        "nbf": int(now.timestamp()),
        "moderator": moderator,
        "context": {
            "user": {
                "id": user_id,
                "name": display_name,
            }
        },
    }
    return jwt.encode(
        payload,
        settings.jitsi_app_secret,
        algorithm="HS256",
    )
