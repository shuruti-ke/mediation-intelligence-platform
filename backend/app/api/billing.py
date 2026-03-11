"""Usage and billing routes - track from Day 1."""
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.tenant import User
from app.models.billing import UsageMeteringEvent
from app.schemas.billing import UsageSummary

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/usage", response_model=UsageSummary)
async def get_usage(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    period_days: int = Query(30, ge=1, le=365),
) -> UsageSummary:
    """Get usage summary for tenant. Even if billing not live, tracks for pricing."""
    if not user.tenant_id:
        return UsageSummary()

    period_end = datetime.utcnow()
    period_start = period_end - timedelta(days=period_days)

    result = await db.execute(
        select(UsageMeteringEvent.event_type, func.sum(UsageMeteringEvent.quantity))
        .where(
            UsageMeteringEvent.tenant_id == user.tenant_id,
            UsageMeteringEvent.created_at >= period_start,
            UsageMeteringEvent.created_at <= period_end,
        )
        .group_by(UsageMeteringEvent.event_type)
    )
    rows = result.all()

    summary = UsageSummary(period_start=period_start, period_end=period_end)
    for event_type, quantity in rows:
        if event_type == "SESSION":
            summary.sessions = int(quantity)
        elif event_type == "RECORDING_MINUTE":
            summary.recording_minutes = float(quantity)
        elif event_type == "AI_QUERY":
            summary.ai_queries = int(quantity)
        elif event_type == "AI_TOKEN":
            summary.ai_tokens = int(quantity)
        elif event_type == "STORAGE_GB":
            summary.storage_gb = float(quantity)

    return summary
