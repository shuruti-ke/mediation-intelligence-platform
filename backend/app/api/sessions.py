"""Session and Jitsi room routes."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, require_role
from app.core.config import get_settings
from app.core.database import get_db
from app.models.tenant import User
from app.models.case import Case, MediationSession
from app.models.booking import FreeTierUsage
from app.schemas.case import SessionCreate, SessionResponse, JitsiRoomResponse
from app.services.usage import record_usage

router = APIRouter(prefix="/sessions", tags=["sessions"])
settings = get_settings()


@router.post("", response_model=SessionResponse)
async def create_session(
    data: SessionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator", "trainee")),
) -> MediationSession:
    """Create mediation session. Generates Jitsi room name."""
    result = await db.execute(select(Case).where(Case.id == data.case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if user.tenant_id and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")

    room_name = f"mediation-{data.case_id}-{uuid.uuid4().hex[:8]}"
    session = MediationSession(
        case_id=data.case_id,
        scheduled_at=data.scheduled_at,
        jitsi_room_name=room_name,
        status="SCHEDULED",
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


@router.get("/case/{case_id}", response_model=list[SessionResponse])
async def list_sessions_for_case(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MediationSession]:
    """List sessions for a case. Session history."""
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if user.tenant_id and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    result = await db.execute(
        select(MediationSession).where(MediationSession.case_id == case_id).order_by(MediationSession.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{session_id}/room", response_model=JitsiRoomResponse)
async def get_jitsi_room(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JitsiRoomResponse:
    """Get Jitsi room URL/name for session. Tenant-isolated."""
    result = await db.execute(
        select(MediationSession).where(MediationSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    result = await db.execute(select(Case).where(Case.id == session.case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if user.tenant_id and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return JitsiRoomResponse(
        room_name=session.jitsi_room_name or f"mediation-{session_id}",
        jitsi_domain=settings.jitsi_domain,
    )


@router.post("/{session_id}/start")
async def start_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator", "trainee")),
) -> SessionResponse:
    """Mark session as ACTIVE, set started_at."""
    result = await db.execute(select(MediationSession).where(MediationSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    result = await db.execute(select(Case).where(Case.id == session.case_id))
    case = result.scalar_one_or_none()
    if user.tenant_id and case and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    session.status = "ACTIVE"
    session.started_at = datetime.utcnow()
    await db.flush()
    if user.tenant_id:
        await record_usage(db, user.tenant_id, "SESSION", 1, session.case_id)
    await db.refresh(session)
    return session


class EndSessionBody(BaseModel):
    free_tier_email: str | None = None  # When provided, consume free tier for this email


@router.post("/{session_id}/end")
async def end_session(
    session_id: uuid.UUID,
    body: EndSessionBody | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator", "trainee")),
) -> SessionResponse:
    """Mark session as ENDED, set ended_at. Optionally consume free tier."""
    result = await db.execute(select(MediationSession).where(MediationSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    result = await db.execute(select(Case).where(Case.id == session.case_id))
    case = result.scalar_one_or_none()
    if user.tenant_id and case and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    session.status = "ENDED"
    session.ended_at = datetime.utcnow()

    if body and body.free_tier_email:
        usage_result = await db.execute(
            select(FreeTierUsage).where(FreeTierUsage.email == body.free_tier_email)
        )
        usage = usage_result.scalar_one_or_none()
        if usage and usage.sessions_used < usage.max_free_sessions:
            usage.sessions_used += 1

    await db.flush()
    await db.refresh(session)
    return session


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MediationSession:
    """Get session by ID."""
    result = await db.execute(
        select(MediationSession).where(MediationSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    result = await db.execute(select(Case).where(Case.id == session.case_id))
    case = result.scalar_one_or_none()
    if user.tenant_id and case and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return session
