"""In-app notifications API - Phase 1."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.tenant import User
from app.models.notification import InAppNotification

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    """List notifications for current user."""
    q = select(InAppNotification).where(InAppNotification.user_id == user.id)
    if unread_only:
        q = q.where(InAppNotification.read_at.is_(None))
    q = q.order_by(InAppNotification.created_at.desc()).limit(limit)
    result = await db.execute(q)
    notifications = result.scalars().all()
    return [
        {
            "id": str(n.id),
            "title": n.title,
            "body": n.body,
            "type": n.type,
            "link": n.link,
            "read": n.read_at is not None,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications
    ]


class MarkReadRequest(BaseModel):
    ids: list[uuid.UUID] | None = None  # None = mark all as read


@router.patch("/read")
async def mark_notifications_read(
    data: MarkReadRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Mark notifications as read."""
    q = update(InAppNotification).where(InAppNotification.user_id == user.id)
    if data.ids:
        q = q.where(InAppNotification.id.in_(data.ids))
    q = q.values(read_at=datetime.utcnow())
    await db.execute(q)
    await db.flush()
    return {"message": "Marked as read"}


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get count of unread notifications."""
    from sqlalchemy import func
    q = select(func.count(InAppNotification.id)).where(
        InAppNotification.user_id == user.id,
        InAppNotification.read_at.is_(None),
    )
    result = await db.execute(q)
    count = result.scalar() or 0
    return {"count": count}
