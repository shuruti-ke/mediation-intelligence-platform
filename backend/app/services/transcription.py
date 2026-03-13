"""AI transcription via OpenAI Whisper API."""
from typing import Any

from app.core.config import get_settings


async def transcribe_audio(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """
    Transcribe audio using OpenAI Whisper API.
    Returns {text: str, segments: list[dict]} with start/end times per segment.
    Falls back gracefully when no API key.
    """
    settings = get_settings()
    if not settings.openai_api_key:
        return {"text": "", "segments": [], "error": "OPENAI_API_KEY not configured"}

    try:
        import httpx

        # Whisper expects multipart form with 'file' and optional 'model'
        files = {"file": (filename or "audio.webm", file_bytes)}
        data = {"model": "whisper-1", "response_format": "verbose_json"}

        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                files=files,
                data=data,
            )
            r.raise_for_status()
            result = r.json()

        # Standard Whisper transcription returns {"text": "..."}
        # For segments we need the verbose_json response format
        text = result.get("text", "")
        segments = result.get("segments", [])

        if not segments and text:
            # Non-verbose response: create single segment
            segments = [{"start": 0, "end": 0, "text": text}]

        return {"text": text, "segments": segments}
    except Exception as e:
        return {"text": "", "segments": [], "error": str(e)}
