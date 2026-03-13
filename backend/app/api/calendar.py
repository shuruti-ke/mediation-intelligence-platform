"""Calendar API - mediator availability and client bookings."""
import uuid
from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import User
from app.models.calendar import MediatorAvailability, CalendarBooking

router = APIRouter(prefix="/calendar", tags=["calendar"])


class AvailabilityCreate(BaseModel):
    slot_date: date
    start_time: str  # "09:00"
    end_time: str   # "10:00"


class BookingCreate(BaseModel):
    mediator_id: uuid.UUID
    slot_date: date
    start_time: str
    end_time: str
    meeting_type: str = "consultation"  # consultation, mediation, training
    client_email: str | None = None
    notes: str | None = None


def _parse_time(s: str) -> time:
    """Parse HH:MM or HH:MM:SS to time. Raises ValueError on invalid format."""
    if not s or not isinstance(s, str):
        raise ValueError("Time is required")
    parts = s.strip().split(":")
    if len(parts) < 2:
        raise ValueError("Time must be HH:MM format (e.g. 09:00)")
    try:
        h, m = int(parts[0]), int(parts[1])
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError("Invalid time")
        return time(h, m)
    except (ValueError, TypeError) as e:
        raise ValueError("Time must be HH:MM format (e.g. 09:00)") from e


# --- Availability (mediators set their slots) ---

@router.get("/availability")
async def list_availability(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    mediator_id: uuid.UUID | None = Query(None),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
) -> list:
    """List availability slots. Mediators see own; admins see all."""
    q = select(MediatorAvailability)
    if mediator_id:
        q = q.where(MediatorAvailability.mediator_id == mediator_id)
    elif user.role not in ("super_admin",):
        q = q.where(MediatorAvailability.mediator_id == user.id)
    if from_date:
        q = q.where(MediatorAvailability.slot_date >= from_date)
    if to_date:
        q = q.where(MediatorAvailability.slot_date <= to_date)
    q = q.order_by(MediatorAvailability.slot_date, MediatorAvailability.start_time)
    result = await db.execute(q)
    slots = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "mediator_id": str(s.mediator_id),
            "slot_date": s.slot_date.isoformat(),
            "start_time": s.start_time.strftime("%H:%M"),
            "end_time": s.end_time.strftime("%H:%M"),
        }
        for s in slots
    ]


@router.post("/availability")
async def create_availability(
    data: AvailabilityCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator", "trainee")),
) -> dict:
    """Create availability slot. Mediators only for self."""
    start = _parse_time(data.start_time)
    end = _parse_time(data.end_time)
    if end <= start:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    slot = MediatorAvailability(
        mediator_id=user.id,
        tenant_id=user.tenant_id,
        slot_date=data.slot_date,
        start_time=start,
        end_time=end,
    )
    db.add(slot)
    await db.flush()
    await db.refresh(slot)
    return {
        "id": str(slot.id),
        "slot_date": slot.slot_date.isoformat(),
        "start_time": slot.start_time.strftime("%H:%M"),
        "end_time": slot.end_time.strftime("%H:%M"),
    }


@router.delete("/availability/{slot_id}")
async def delete_availability(
    slot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Delete availability slot. Owner or admin only."""
    result = await db.execute(select(MediatorAvailability).where(MediatorAvailability.id == slot_id))
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.mediator_id != user.id and user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not your slot")
    await db.delete(slot)
    await db.flush()
    return {"deleted": True}


# --- Free slots (for booking UI: availability minus scheduled bookings) ---

@router.get("/free-slots")
async def list_free_slots(
    mediator_id: uuid.UUID = Query(...),
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    """List available slots that are not yet booked. For clients/mediators to pick when booking."""
    avail_q = select(MediatorAvailability).where(
        and_(
            MediatorAvailability.mediator_id == mediator_id,
            MediatorAvailability.slot_date >= from_date,
            MediatorAvailability.slot_date <= to_date,
        )
    )
    avail_result = await db.execute(avail_q)
    slots = avail_result.scalars().all()
    if not slots:
        return []
    booked_q = select(CalendarBooking).where(
        and_(
            CalendarBooking.mediator_id == mediator_id,
            CalendarBooking.slot_date >= from_date,
            CalendarBooking.slot_date <= to_date,
            CalendarBooking.status == "scheduled",
        )
    )
    booked_result = await db.execute(booked_q)
    booked = booked_result.scalars().all()
    booked_set = {(b.slot_date, b.start_time, b.end_time) for b in booked}
    free = [
        {
            "id": str(s.id),
            "slot_date": s.slot_date.isoformat(),
            "start_time": s.start_time.strftime("%H:%M"),
            "end_time": s.end_time.strftime("%H:%M"),
        }
        for s in slots
        if (s.slot_date, s.start_time, s.end_time) not in booked_set
    ]
    return free


# --- Bookings (clients book slots) ---

@router.get("/bookings")
async def list_calendar_bookings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    mediator_id: uuid.UUID | None = Query(None),
) -> list:
    """List calendar bookings. Filtered by role."""
    q = select(CalendarBooking)
    if user.role in ("client_corporate", "client_individual"):
        q = q.where(CalendarBooking.client_id == user.id)
    elif user.role in ("mediator", "trainee"):
        q = q.where(CalendarBooking.mediator_id == user.id)
    if mediator_id:
        q = q.where(CalendarBooking.mediator_id == mediator_id)
    if from_date:
        q = q.where(CalendarBooking.slot_date >= from_date)
    if to_date:
        q = q.where(CalendarBooking.slot_date <= to_date)
    q = q.order_by(CalendarBooking.slot_date, CalendarBooking.start_time)
    result = await db.execute(q)
    bookings = result.scalars().all()
    return [
        {
            "id": str(b.id),
            "mediator_id": str(b.mediator_id),
            "client_id": str(b.client_id) if b.client_id else None,
            "client_email": b.client_email,
            "slot_date": b.slot_date.isoformat(),
            "start_time": b.start_time.strftime("%H:%M"),
            "end_time": b.end_time.strftime("%H:%M"),
            "meeting_type": b.meeting_type,
            "status": b.status,
            "notes": b.notes,
        }
        for b in bookings
    ]


@router.post("/bookings")
async def create_calendar_booking(
    data: BookingCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Book a slot. Client books for self; mediator can book on behalf."""
    try:
        start = _parse_time(data.start_time)
        end = _parse_time(data.end_time)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if end <= start:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    # Check availability exists and is free
    avail = await db.execute(
        select(MediatorAvailability).where(
            and_(
                MediatorAvailability.mediator_id == data.mediator_id,
                MediatorAvailability.slot_date == data.slot_date,
                MediatorAvailability.start_time == start,
                MediatorAvailability.end_time == end,
            )
        )
    )
    slot = avail.scalar_one_or_none()
    if not slot:
        raise HTTPException(
            status_code=400,
            detail="That slot is not available. Please select from the available slots shown for your chosen mediator.",
        )

    existing = await db.execute(
        select(CalendarBooking).where(
            and_(
                CalendarBooking.mediator_id == data.mediator_id,
                CalendarBooking.slot_date == data.slot_date,
                CalendarBooking.start_time == start,
                CalendarBooking.status == "scheduled",
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Slot already booked")

    client_id = user.id if user.role in ("client_corporate", "client_individual") else None
    client_email = data.client_email or (user.email if client_id else None)

    booking = CalendarBooking(
        tenant_id=user.tenant_id,
        mediator_id=data.mediator_id,
        client_id=client_id,
        client_email=client_email,
        slot_date=data.slot_date,
        start_time=start,
        end_time=end,
        meeting_type=data.meeting_type,
        status="scheduled",
        notes=data.notes,
    )
    db.add(booking)
    await db.flush()
    await db.refresh(booking)
    return {
        "id": str(booking.id),
        "slot_date": booking.slot_date.isoformat(),
        "start_time": booking.start_time.strftime("%H:%M"),
        "end_time": booking.end_time.strftime("%H:%M"),
        "status": "scheduled",
    }


@router.patch("/bookings/{booking_id}")
async def update_calendar_booking(
    booking_id: uuid.UUID,
    status: str = Query(..., pattern="^(scheduled|completed|cancelled|no_show)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Update booking status. Mediator or admin."""
    result = await db.execute(select(CalendarBooking).where(CalendarBooking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.mediator_id != user.id and user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not your booking")
    booking.status = status
    await db.flush()
    return {"status": status}


@router.get("/mediators")
async def list_mediators_for_booking(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    """List mediators for case assignment and booking. Excludes trainees (trainees cannot be assigned cases)."""
    from app.models.tenant import User as UserModel
    result = await db.execute(
        select(UserModel).where(
            and_(
                UserModel.role == "mediator",
                UserModel.is_active == True,
            )
        )
    )
    mediators = result.scalars().all()
    return [{"id": str(m.id), "display_name": m.display_name or m.email, "email": m.email} for m in mediators]
