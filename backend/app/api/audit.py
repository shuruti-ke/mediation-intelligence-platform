"""Audit log API - Phase 5. Security audit, compliance."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api.deps import require_role
from app.core.database import get_db
from app.core.config import get_settings
from app.models.tenant import User
from app.models.audit import AuditLog

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/security-status")
async def get_security_status(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Phase 5.4: Security compliance checklist. Super-admin only."""
    settings = get_settings()
    # Count recent audit logs (last 7 days)
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(days=7)
    count_result = await db.execute(
        select(func.count(AuditLog.id)).where(AuditLog.created_at >= cutoff)
    )
    recent_count = count_result.scalar() or 0
    return {
        "audit_logs": {
            "enabled": True,
            "recent_7_days": recent_count,
            "status": "ok",
        },
        "encryption": {
            "database": "PostgreSQL supports encryption at rest when enabled at provider (e.g. Render, Neon).",
            "storage": "S3/R2 server-side encryption recommended for documents and recordings.",
            "status": "configure_at_provider",
        },
        "key_rotation": {
            "jwt_secret": "Rotate SECRET_KEY in env; existing tokens remain valid until expiry.",
            "recommendation": "Set SECRET_KEY to a strong random value; rotate annually or after compromise.",
            "status": "ok" if settings.secret_key != "change-me-in-production" else "warning",
        },
        "compliance_checklist": [
            {"item": "Audit logging", "status": "ok", "detail": f"{recent_count} logs in last 7 days"},
            {"item": "JWT secret configured", "status": "ok" if settings.secret_key != "change-me-in-production" else "warning", "detail": "Set SECRET_KEY in production"},
            {"item": "Encryption at rest", "status": "info", "detail": "Configure at database and storage provider"},
            {"item": "HTTPS", "status": "ok", "detail": "Enforced in production (Vercel/Render)"},
        ],
    }


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
