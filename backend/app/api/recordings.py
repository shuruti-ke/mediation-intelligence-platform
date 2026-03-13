"""Recording routes - Phase 2. Jibri integration when self-hosted."""
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import User
from app.models.case import Case, MediationSession, SessionRecording, SessionTranscript, CaseParticipant
from app.services.usage import record_usage
from app.services.transcription import transcribe_audio

router = APIRouter(prefix="/sessions", tags=["recordings"])
download_router = APIRouter(prefix="/recordings", tags=["recordings"])


class RecordingStartRequest(BaseModel):
    consent_confirmed: bool = False


async def _verify_session_access(db: AsyncSession, session_id: uuid.UUID, user: User) -> MediationSession | None:
    """Verify user has access to session via case tenant. Returns session or None."""
    result = await db.execute(select(MediationSession).where(MediationSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        return None
    case_result = await db.execute(select(Case).where(Case.id == session.case_id))
    case = case_result.scalar_one_or_none()
    if not case or (user.tenant_id and case.tenant_id != user.tenant_id):
        return None
    return session


@router.get("/{session_id}/recordings")
async def list_recordings(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> list:
    """List recordings for a session."""
    session = await _verify_session_access(db, session_id, user)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    result = await db.execute(
        select(SessionRecording)
        .where(SessionRecording.session_id == session_id)
        .order_by(SessionRecording.started_at.desc())
    )
    recordings_list = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "session_id": str(r.session_id),
            "storage_path": r.storage_path,
            "duration_seconds": r.duration_seconds,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "ended_at": r.ended_at.isoformat() if r.ended_at else None,
            "consent_confirmed": r.consent_confirmed,
            "created_at": r.created_at.isoformat(),
        }
        for r in recordings_list
    ]


@download_router.get("/{recording_id}/download")
async def download_recording(
    recording_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """Download recording file. Redirects to storage URL if external, or serves file if local."""
    result = await db.execute(select(SessionRecording).where(SessionRecording.id == recording_id))
    recording = result.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    session = await _verify_session_access(db, recording.session_id, user)
    if not session:
        raise HTTPException(status_code=404, detail="Recording not found")
    storage_path = recording.storage_path
    if not storage_path:
        raise HTTPException(status_code=404, detail="Recording file not available")
    # If storage_path is a URL (S3, CDN, etc.), redirect to it
    if storage_path.startswith("http://") or storage_path.startswith("https://"):
        return RedirectResponse(url=storage_path, status_code=302)
    # Local file path
    if not os.path.exists(storage_path):
        raise HTTPException(status_code=404, detail="Recording file not found")
    filename = os.path.basename(storage_path) or f"recording-{recording_id}.mp4"
    return FileResponse(
        storage_path,
        filename=filename,
        media_type="video/mp4",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


@download_router.post("/{recording_id}/transcribe")
async def transcribe_recording(
    recording_id: uuid.UUID,
    file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> dict:
    """Transcribe recording via OpenAI Whisper. Accepts audio file upload or uses stored recording."""
    result = await db.execute(select(SessionRecording).where(SessionRecording.id == recording_id))
    recording = result.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    # Verify user has access to the session's case
    sess_result = await db.execute(select(MediationSession).where(MediationSession.id == recording.session_id))
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    from app.models.case import Case
    case_result = await db.execute(select(Case).where(Case.id == session.case_id))
    case = case_result.scalar_one_or_none()
    if case and user.tenant_id and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")

    file_bytes: bytes | None = None
    filename: str = "audio.webm"

    if file:
        file_bytes = await file.read()
        filename = file.filename or filename
    elif recording.storage_path and os.path.isfile(recording.storage_path):
        with open(recording.storage_path, "rb") as f:
            file_bytes = f.read()
        filename = os.path.basename(recording.storage_path)
    else:
        raise HTTPException(
            status_code=400,
            detail="No audio provided. Upload an audio file or ensure the recording is stored.",
        )

    if not file_bytes or len(file_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio file too small or empty")

    out = await transcribe_audio(file_bytes, filename)
    if "error" in out and out["error"] and not out.get("text"):
        raise HTTPException(status_code=503, detail=f"Transcription failed: {out['error']}")

    transcript = SessionTranscript(
        recording_id=recording_id,
        content_text=out.get("text", ""),
        segments_json=out.get("segments"),
    )
    db.add(transcript)
    await db.flush()

    return {
        "text": out.get("text", ""),
        "segments": out.get("segments", []),
        "transcript_id": str(transcript.id),
    }
