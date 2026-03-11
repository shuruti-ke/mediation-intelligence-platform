"""Analytics - opt-in, consent-required. Phase 1."""
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import AnalyticsEvent


async def track_event(
    db: AsyncSession,
    event_name: str,
    user_id: UUID | None = None,
    tenant_id: UUID | None = None,
    event_data: dict | None = None,
    consent_given: bool = False,
) -> None:
    """Track analytics event. Only when consent given."""
    event = AnalyticsEvent(
        event_name=event_name,
        user_id=user_id,
        tenant_id=tenant_id,
        event_data=event_data,
        consent_given=consent_given,
    )
    db.add(event)
