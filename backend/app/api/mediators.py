"""Mediator matching - Phase 4. AI-assisted or admin-assisted allocation."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import User

router = APIRouter(prefix="/mediators", tags=["mediators"])


@router.get("/match")
async def match_mediators(
    dispute_category: str | None = Query(None),
    tenant_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> list:
    """Match mediators for a case. Filter by dispute category and tenant."""
    q = select(User).where(
        and_(
            User.role.in_(["mediator", "trainee"]),
            User.is_active == True,
        )
    )
    if tenant_id:
        q = q.where(User.tenant_id == tenant_id)
    elif user.tenant_id:
        q = q.where(User.tenant_id == user.tenant_id)

    result = await db.execute(q)
    mediators = result.scalars().all()

    # TODO: AI-assisted matching by dispute_category, availability, workload
    # For now return all matching mediators
    return [
        {
            "id": str(m.id),
            "email": m.email,
            "display_name": m.display_name or m.email.split("@")[0],
            "role": m.role,
        }
        for m in mediators
    ]
