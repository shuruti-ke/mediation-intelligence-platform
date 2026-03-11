"""Usage metering service - record billable events."""
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import UsageMeteringEvent


async def record_usage(
    db: AsyncSession,
    tenant_id: UUID,
    event_type: str,
    quantity: float,
    case_id: UUID | None = None,
    metadata: dict | None = None,
) -> None:
    """Record a usage event. Called by other services."""
    event = UsageMeteringEvent(
        tenant_id=tenant_id,
        event_type=event_type,
        quantity=quantity,
        case_id=case_id,
        metadata_json=metadata,
    )
    db.add(event)
