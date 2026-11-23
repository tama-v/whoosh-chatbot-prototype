import logging

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from app.core.config import MAX_AUDIO_BYTES
from app.schemas import VoiceRequest
from app.services.voice import (
    VoiceUnavailable,
    synthesize,
    transcribe,
)

logger = logging.getLogger("whoosh_ai.voice")
router = APIRouter(prefix="/voice", tags=["voice"])


@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...), language: str = Form(default="id")) -> dict:
    if language not in {"id", "en"}:
        raise HTTPException(status_code=422, detail="Bahasa harus 'id' atau 'en'")
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=422, detail="Rekaman kosong")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Rekaman melebihi 10 MB")
    try:
        return await transcribe(data, audio.content_type or "audio/webm", language)
    except VoiceUnavailable as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/synthesize")
async def synthesize_audio(payload: VoiceRequest) -> Response:
    try:
        result = await synthesize(payload.text, payload.language, payload.voice_id)
    except VoiceUnavailable as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    headers = {
        "X-Voice-Cached": "1" if result["cached"] else "0",
        "Cache-Control": "private, max-age=3600",
    }
    if result.get("notice"):
        headers["X-Voice-Notice"] = result["notice"]
    return Response(content=result["audio"], media_type="audio/wav", headers=headers)
