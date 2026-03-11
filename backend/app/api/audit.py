"""Audit log API - Phase 5. Security audit, compliance."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import require_role
from app.core.database import get_db
from app.models.tenant import User
from app.models.audit import AuditLog

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs")
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
    resource_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> list:
    """List audit logs. Super-admin only."""
    q = select(AuditLog)
    if user.tenant_id:
        q = q.where(AuditLog.tenant_id == user.tenant_id)
    if resource_type:
        q = q.where(AuditLog.resource_type == resource_type)
    q = q.order_by(AuditLog.created_at.desc()).limit(limit)
    result = await db.execute(q)
    logs = result.scalars().all()
    return [
        {
            "id": str(l.id),
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "user_id": str(l.user_id) if l.user_id else None,
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]
