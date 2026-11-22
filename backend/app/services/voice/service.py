"""Qwen ASR/TTS clients with an offline demo fallback.

Only the backend calls DashScope; the API key never reaches the browser.
When no key is configured, English speech can still be produced with the
Windows SAPI voice installed on the server, while Indonesian falls back to the
browser voice on the client.
"""

import asyncio
import base64
import hashlib
import logging
import os
import re
import shutil
import subprocess
import tempfile
from functools import lru_cache
from pathlib import Path

import httpx

from app.core.config import (
    DASHSCOPE_API_KEY,
    DEMO_TTS_ENABLED,
    DEMO_TTS_NOTICE,
    QWEN_ASR_MODEL,
    QWEN_BASE_URL,
    QWEN_TTS_MODEL,
    QWEN_TTS_URL,
    QWEN_TTS_VOICE_EN,
    QWEN_TTS_VOICE_ID,
    TTS_CACHE_DIR,
    VOICE_ASR_CONFIGURED,
    VOICE_TTS_CONFIGURED,
)

logger = logging.getLogger("whoosh_ai.voice")


class VoiceUnavailable(RuntimeError):
    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code


def voice_catalog() -> dict:
    if VOICE_TTS_CONFIGURED:
        return {
            "id": [
                {
                    "id": "auto",
                    "label": "Embun - Bahasa Indonesia",
                    "engine": "qwen",
                    "voice": QWEN_TTS_VOICE_ID or None,
                }
            ],
            "en": [
                {
                    "id": "auto",
                    "label": "Ava - English" if QWEN_TTS_VOICE_EN else "Qwen English voice",
                    "engine": "qwen",
                    "voice": QWEN_TTS_VOICE_EN or QWEN_TTS_VOICE_ID or None,
                }
            ],
        }
    en_sapi = _pick_sapi_voice("en") if DEMO_TTS_ENABLED else None
    return {
        "id": [
            {
                "id": "auto",
                "label": "Suara browser - Bahasa Indonesia",
                "engine": "browser",
                "voice": None,
            }
        ],
        "en": [
            {
                "id": "auto",
                "label": f"{en_sapi} - English (SAPI demo)" if en_sapi else "Suara browser - English",
                "engine": "demo-sapi" if en_sapi else "browser",
                "voice": en_sapi,
            }
        ],
    }


def _voice_for(language: str, voice_id: str) -> str:
    if language == "en":
        return QWEN_TTS_VOICE_EN or QWEN_TTS_VOICE_ID
    return QWEN_TTS_VOICE_ID


def speakable_text(text: str, limit: int = 1800) -> str:
    clean = re.sub(r"```[\s\S]*?```", " ", text)
    clean = re.sub(r"^#+\s*", "", clean, flags=re.MULTILINE)
    clean = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", clean)
    clean = re.sub(r"[*_`>|]", "", clean)
    clean = re.sub(r"^\s*[-–]\s*", "", clean, flags=re.MULTILINE)
    clean = re.sub(r"\s+", " ", clean).strip()
    if len(clean) > limit:
        cut = clean[:limit]
        boundary = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
        clean = cut[:boundary + 1] if boundary > limit * 0.6 else cut
    return clean


async def transcribe(data: bytes, mime: str, language: str) -> dict:
    if not VOICE_ASR_CONFIGURED:
        raise VoiceUnavailable(
            "ASR Qwen belum dikonfigurasi. Isi DASHSCOPE_API_KEY dan QWEN_BASE_URL di backend, "
            "atau gunakan speech recognition browser.",
            status_code=503,
        )
    encoded = base64.b64encode(data).decode("ascii")
    data_uri = f"data:{mime or 'audio/webm'};base64,{encoded}"
    payload = {
        "model": QWEN_ASR_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [{"type": "input_audio", "input_audio": {"data": data_uri}}],
            }
        ],
        "asr_options": {"language": "id" if language == "id" else "en"},
        "stream": False,
    }
    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0)) as client:
            response = await client.post(f"{QWEN_BASE_URL}/chat/completions", headers=headers, json=payload)
        if response.status_code >= 400:
            logger.warning("Qwen ASR error %s: %s", response.status_code, response.text[:300])
            raise VoiceUnavailable("Layanan ASR Qwen menolak permintaan transkripsi.", status_code=502)
        body = response.json()
    except VoiceUnavailable:
        raise
    except Exception as exc:
        logger.exception("Qwen ASR request failed")
        raise VoiceUnavailable(f"Transkripsi Qwen gagal: {exc}", status_code=502) from exc

    text = _extract_asr_text(body)
    if not text:
        raise VoiceUnavailable("Transkrip kosong. Coba bicara lebih dekat ke mikrofon.", status_code=422)
    return {"text": text, "provider": "qwen", "model": QWEN_ASR_MODEL, "language": language}


def _extract_asr_text(body: dict) -> str:
    choices = body.get("choices") or []
    if choices:
        content = (choices[0].get("message") or {}).get("content")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts = [
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and part.get("type") in {"text", "output_text"}
            ]
            return " ".join(part for part in parts if part).strip()
    output = body.get("output") or {}
    if isinstance(output.get("text"), str):
        return output["text"].strip()
    return ""


def _cache_path(kind: str, text: str, voice: str, language: str) -> Path:
    digest = hashlib.sha256(f"{kind}|{voice}|{language}|{text}".encode("utf-8")).hexdigest()[:32]
    return TTS_CACHE_DIR / f"{kind}-{language}-{digest}.wav"


async def synthesize(text: str, language: str, voice_id: str = "auto") -> dict:
    spoken = speakable_text(text)
    if not spoken:
        raise VoiceUnavailable("Teks untuk dibacakan kosong.", status_code=422)

    if VOICE_TTS_CONFIGURED:
        voice = _voice_for(language, voice_id)
        cached = _cache_path("qwen", spoken, voice, language)
        if cached.exists():
            return _audio_result(cached, "qwen", QWEN_TTS_MODEL, cached=True)
        try:
            audio = await _qwen_tts(spoken, voice, language)
            cached.write_bytes(audio)
            return _audio_result(cached, "qwen", QWEN_TTS_MODEL, cached=False)
        except VoiceUnavailable as exc:
            logger.warning("Qwen TTS unavailable, trying demo fallback: %s", exc)

    if DEMO_TTS_ENABLED:
        demo = await asyncio.to_thread(_sapi_synthesize, spoken, language)
        if demo:
            path, voice_name = demo
            return _audio_result(path, "demo-sapi", f"Windows SAPI - {voice_name}", cached=True, notice=DEMO_TTS_NOTICE)

    if language == "id":
        raise VoiceUnavailable(
            "Suara server Indonesia belum aktif. Isi DASHSCOPE_API_KEY untuk Qwen TTS; "
            "tanpa kunci, browser akan memakai suara Indonesia bawaannya.",
            status_code=503,
        )
    raise VoiceUnavailable(
        "TTS server tidak tersedia. Browser akan memakai suara bawaannya.",
        status_code=503,
    )


def _audio_result(path: Path, provider: str, model: str, cached: bool, notice: str | None = None) -> dict:
    return {
        "audio": path.read_bytes(),
        "provider": provider,
        "model": model,
        "cached": cached,
        "notice": notice,
    }


async def _qwen_tts(text: str, voice: str, language: str) -> bytes:
    payload = {
        "model": QWEN_TTS_MODEL,
        "input": {
            "text": text,
            "voice": voice,
            "format": "wav",
            "sample_rate": 24000,
            "language_hints": ["id" if language == "id" else "en"],
        },
    }
    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0)) as client:
        response = await client.post(QWEN_TTS_URL, headers=headers, json=payload)
        if response.status_code >= 400:
            logger.warning("Qwen TTS error %s: %s", response.status_code, response.text[:300])
            raise VoiceUnavailable("Layanan TTS Qwen menolak permintaan suara.", status_code=502)
        body = response.json()
        audio = body.get("output", {}).get("audio") or {}
        if isinstance(audio, str):
            audio = {"url": audio} if audio.startswith("http") else {"data": audio}
        url = audio.get("url")
        if url:
            download = await client.get(url)
            download.raise_for_status()
            return download.content
        data = audio.get("data")
        if data:
            return base64.b64decode(data)
    raise VoiceUnavailable("Respons TTS Qwen tidak berisi audio.", status_code=502)


@lru_cache(maxsize=1)
def _sapi_voices() -> list[dict]:
    if os.name != "nt" or not shutil.which("powershell"):
        return []
    script = (
        "Add-Type -AssemblyName System.Speech; "
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        "$s.GetInstalledVoices() | ForEach-Object { $i = $_.VoiceInfo; "
        "Write-Output ($i.Name + '|' + $i.Culture.Name) }; $s.Dispose()"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (OSError, subprocess.SubprocessError):
        return []
    voices = []
    for line in result.stdout.splitlines():
        if "|" in line:
            name, culture = line.strip().split("|", 1)
            voices.append({"name": name, "culture": culture})
    return voices


def synthesize_demo_available(language: str) -> bool:
    if not DEMO_TTS_ENABLED:
        return False
    return _pick_sapi_voice(language) is not None


def _pick_sapi_voice(language: str) -> str | None:
    voices = _sapi_voices()
    if not voices:
        return None
    prefix = "id" if language == "id" else "en"
    candidates = [voice for voice in voices if voice["culture"].lower().startswith(prefix)]
    if not candidates:
        return None
    for preferred in ("zira", "aria", "jenny", "ava", "gadis", "andika"):
        for voice in candidates:
            if preferred in voice["name"].lower():
                return voice["name"]
    return candidates[0]["name"]


def _sapi_synthesize(text: str, language: str) -> tuple[Path, str] | None:
    voice = _pick_sapi_voice(language)
    if not voice:
        return None
    cached = _cache_path("sapi", text, voice, language)
    if cached.exists():
        return cached, voice

    descriptor, script_name = tempfile.mkstemp(suffix=".ps1", prefix="whoosh-tts-")
    os.close(descriptor)
    script_path = Path(script_name)
    text_b64 = base64.b64encode(text.encode("utf-8")).decode("ascii")
    voice_b64 = base64.b64encode(voice.encode("utf-8")).decode("ascii")
    out_path = str(cached)
    script = f"""$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{text_b64}'))
$voice = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{voice_b64}'))
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {{ $s.SelectVoice($voice) }} catch {{ }}
$s.Rate = 0
$s.SetOutputToWaveFile('{out_path}')
$s.Speak($text)
$s.Dispose()
"""
    try:
        script_path.write_text(script, encoding="utf-8")
        subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script_path)],
            capture_output=True,
            text=True,
            timeout=60,
            check=True,
        )
        if cached.exists() and cached.stat().st_size > 1000:
            return cached, voice
    except (OSError, subprocess.SubprocessError) as exc:
        logger.warning("Demo SAPI TTS failed: %s", exc)
    finally:
        try:
            script_path.unlink()
        except OSError:
            pass
    return None


def _language_engine(language: str) -> str:
    if VOICE_TTS_CONFIGURED:
        return "qwen"
    return "demo-sapi" if synthesize_demo_available(language) else "browser"


def health_payload() -> dict:
    provider = "qwen" if VOICE_TTS_CONFIGURED else ("demo-sapi" if synthesize_demo_available("en") else "browser")
    return {
        "asr_configured": VOICE_ASR_CONFIGURED,
        "tts_configured": VOICE_TTS_CONFIGURED,
        "asr_model": QWEN_ASR_MODEL if VOICE_ASR_CONFIGURED else None,
        "tts_model": QWEN_TTS_MODEL if VOICE_TTS_CONFIGURED else None,
        "demo_tts": synthesize_demo_available("en"),
        "provider": provider,
        "languages": {"id": _language_engine("id"), "en": _language_engine("en")},
        "voices": voice_catalog(),
    }
