"""Booking flow - Phase 4. Intake, consultation."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import User, Tenant
from app.models.case import Case
from app.models.booking import Booking, FreeTierUsage

router = APIRouter(prefix="/bookings", tags=["bookings"])


class BookingCreate(BaseModel):
    booking_type: str  # intake, consultation, training
    client_email: EmailStr
    client_phone: str | None = None
    client_name: str | None = None
    dispute_category: str | None = None
    preferred_date: datetime | None = None
    notes: str | None = None
    use_free_tier: bool = False


@router.post("")
async def create_booking(
    data: BookingCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Create mediation intake or consultation booking."""
    tenant_id = user.tenant_id
    if not tenant_id and user.role != "super_admin":
        raise HTTPException(status_code=400, detail="Tenant required for booking")

    if data.use_free_tier:
        result = await db.execute(select(FreeTierUsage).where(FreeTierUsage.email == data.client_email))
        usage = result.scalar_one_or_none()
        if usage and usage.sessions_used >= usage.max_free_sessions:
            raise HTTPException(status_code=400, detail="No free sessions remaining for this email")
        if not usage:
            usage = FreeTierUsage(email=data.client_email, max_free_sessions=1)
            db.add(usage)
            await db.flush()

    booking = Booking(
        tenant_id=tenant_id,
        booking_type=data.booking_type,
        client_email=data.client_email,
        client_phone=data.client_phone,
        client_name=data.client_name,
        dispute_category=data.dispute_category,
        preferred_date=data.preferred_date,
        notes=data.notes,
        status="PENDING",
    )
    db.add(booking)
    await db.flush()
    await db.refresh(booking)
    return {
        "id": str(booking.id),
        "status": "PENDING",
        "message": "Booking received. We'll confirm your session shortly.",
    }


@router.get("")
async def list_bookings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
) -> list:
    """List bookings. Tenant-filtered."""
    q = select(Booking)
    if user.tenant_id:
        q = q.where(Booking.tenant_id == user.tenant_id)
    if status:
        q = q.where(Booking.status == status)
    q = q.order_by(Booking.created_at.desc()).limit(limit)
    result = await db.execute(q)
    bookings = result.scalars().all()
    return [
        {
            "id": str(b.id),
            "booking_type": b.booking_type,
            "client_email": b.client_email,
            "client_name": b.client_name,
            "dispute_category": b.dispute_category,
            "status": b.status,
            "created_at": b.created_at.isoformat(),
        }
        for b in bookings
    ]


@router.post("/{booking_id}/confirm")
async def confirm_booking(
    booking_id: uuid.UUID,
    case_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> dict:
    """Confirm booking, optionally link to case."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.tenant_id and booking.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")

    booking.status = "CONFIRMED"
    if case_id:
        booking.case_id = case_id
    await db.flush()
    return {"status": "CONFIRMED"}
