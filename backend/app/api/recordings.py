"""Recording routes - Phase 2. Jibri integration when self-hosted."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import User
from app.models.case import MediationSession, SessionRecording, CaseParticipant
from app.services.usage import record_usage

router = APIRouter(prefix="/sessions", tags=["recordings"])


class RecordingStartRequest(BaseModel):
    consent_confirmed: bool = False


@router.post("/{session_id}/recording/start")
async def start_recording(
    session_id: uuid.UUID,
    data: RecordingStartRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> dict:
    """Start recording. Validates consent. In Phase 2, triggers Jibri."""
    if not data.consent_confirmed:
        raise HTTPException(status_code=400, detail="Consent must be confirmed before recording")

    result = await db.execute(select(MediationSession).where(MediationSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check participant consent (simplified for MVP)
    recording = SessionRecording(
        session_id=session_id,
        started_at=datetime.utcnow(),
        consent_confirmed=True,
    )
    db.add(recording)
    await db.flush()
    await db.refresh(recording)

    # TODO Phase 2: Trigger Jibri via Prosody/API when self-hosted
    return {"recording_id": str(recording.id), "status": "started", "message": "Recording started (Jibri integration pending)"}


@router.post("/{session_id}/recording/stop")
async def stop_recording(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> dict:
    """Stop recording. Updates duration, moves file to S3 (Phase 2)."""
    result = await db.execute(
        select(SessionRecording)
        .where(SessionRecording.session_id == session_id)
        .order_by(SessionRecording.started_at.desc())
        .limit(1)
    )
    recording = result.scalar_one_or_none()
    if not recording or recording.ended_at:
        raise HTTPException(status_code=404, detail="No active recording found")

    recording.ended_at = datetime.utcnow()
    if recording.started_at:
        recording.duration_seconds = int((recording.ended_at - recording.started_at).total_seconds())

    # Record usage for billing
    from app.models.case import Case
    case_result = await db.execute(select(MediationSession).where(MediationSession.id == session_id))
    sess = case_result.scalar_one_or_none()
    if sess and user.tenant_id:
        case_res = await db.execute(select(Case).where(Case.id == sess.case_id))
        case = case_res.scalar_one_or_none()
        if case:
            await record_usage(db, user.tenant_id, "RECORDING_MINUTE", recording.duration_seconds / 60, case.id)

    await db.flush()
    return {"status": "stopped", "duration_seconds": recording.duration_seconds}


@router.post("/{session_id}/caucus")
async def create_caucus_room(
    session_id: uuid.UUID,
    party: str = "party_a",  # party_a, party_b
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> dict:
    """Create caucus (breakout) room. Separate Jitsi room per party."""
    from app.core.config import get_settings
    from app.core.security import create_jitsi_jwt

    result = await db.execute(select(MediationSession).where(MediationSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    settings = get_settings()
    base_room = f"mediation-{session.case_id}-caucus-{party}"
    room_name = base_room
    domain = settings.jitsi_domain
    jwt_token = None
    jaas_app_id = None
    if settings.jaas_app_id and settings.jaas_private_key and settings.jaas_api_key_id:
        sub = settings.jaas_app_id
        if not sub.startswith("vpaas-magic-cookie-"):
            sub = f"vpaas-magic-cookie-{sub}"
        room_name = f"{sub}/{base_room}"
        domain = "8x8.vc"
        jaas_app_id = sub
        jwt_token = create_jitsi_jwt(
            room_name=room_name,
            user_id=str(user.id),
            display_name=user.display_name or user.email,
            moderator=True,
        )
    return {"room_name": room_name, "jitsi_domain": domain, "jwt": jwt_token, "jaas_app_id": jaas_app_id}
