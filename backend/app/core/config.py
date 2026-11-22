import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
APP_DIR = BACKEND_DIR / "app"
KNOWLEDGE_DIR = BACKEND_DIR / "knowledge"
DATA_DIR = BACKEND_DIR / "data"
UPLOAD_DIR = BACKEND_DIR / "uploads"
TTS_CACHE_DIR = DATA_DIR / "tts_cache"
DB_PATH = Path(os.getenv("DATABASE_PATH", str(DATA_DIR / "whoosh_ai_demo.db")))

for folder in (DATA_DIR, UPLOAD_DIR, TTS_CACHE_DIR):
    folder.mkdir(parents=True, exist_ok=True)

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "").strip()
QWEN_BASE_URL = os.getenv("QWEN_BASE_URL", "").strip().rstrip("/")
QWEN_CHAT_MODEL = os.getenv("QWEN_CHAT_MODEL", "qwen3.7-plus").strip()
QWEN_EMBEDDING_MODEL = os.getenv("QWEN_EMBEDDING_MODEL", "text-embedding-v4").strip()
QWEN_ASR_MODEL = os.getenv("QWEN_ASR_MODEL", "qwen3-asr-flash").strip()
QWEN_TTS_MODEL = os.getenv("QWEN_TTS_MODEL", "qwen-audio-3.1-tts-flash").strip()
QWEN_TTS_VOICE_ID = os.getenv("QWEN_TTS_VOICE_ID", "qwen-audio-3.1-tts-flash-embun_id").strip()
QWEN_TTS_VOICE_EN = os.getenv("QWEN_TTS_VOICE_EN", "").strip()


def _api_root(base_url: str) -> str:
    marker = "/compatible-mode/"
    if marker in base_url:
        return base_url.split(marker)[0]
    return base_url.rstrip("/")


QWEN_TTS_API_BASE = os.getenv("QWEN_TTS_API_BASE", "").strip().rstrip("/") or _api_root(QWEN_BASE_URL)


def _tts_url() -> str:
    if not QWEN_TTS_API_BASE:
        return ""
    if QWEN_TTS_API_BASE.endswith("SpeechSynthesizer"):
        return QWEN_TTS_API_BASE
    return f"{QWEN_TTS_API_BASE}/api/v1/services/audio/tts/SpeechSynthesizer"


QWEN_TTS_URL = _tts_url()

AI_CONFIGURED = bool(DASHSCOPE_API_KEY and QWEN_BASE_URL)
EMBEDDINGS_CONFIGURED = bool(AI_CONFIGURED and QWEN_EMBEDDING_MODEL)
VOICE_ASR_CONFIGURED = bool(AI_CONFIGURED and QWEN_ASR_MODEL)
VOICE_TTS_CONFIGURED = bool(AI_CONFIGURED and QWEN_TTS_MODEL and QWEN_TTS_URL)
DEMO_TTS_ENABLED = os.getenv("DEMO_TTS_ENABLED", "1").strip() not in {"0", "false", "False"}

APP_NAME = "Whoosh AI"
DEMO_USER_ID = "demo-passenger"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_HISTORY_MESSAGES = 12
ALLOWED_DOC_TYPES = {".pdf", ".txt", ".md", ".markdown"}

SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "whoosh_session").strip() or "whoosh_session"
SESSION_TTL_DAYS = max(1, int(os.getenv("SESSION_TTL_DAYS", "7")))
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "0").strip().lower() in {"1", "true", "yes"}
ADMIN_BOOTSTRAP_PATH = DATA_DIR / "admin_bootstrap.txt"
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@whoosh.local").strip().lower()
ADMIN_NAME = os.getenv("ADMIN_NAME", "Admin Whoosh").strip() or "Admin Whoosh"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
GUEST_HEADER = "X-Guest-Id"

RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "1").strip().lower() not in {"0", "false", "no"}
RATE_LIMIT_TRUST_PROXY = os.getenv("RATE_LIMIT_TRUST_PROXY", "0").strip().lower() in {"1", "true", "yes"}
RATE_LIMIT_LOGIN = max(1, int(os.getenv("RATE_LIMIT_LOGIN", "10")))
RATE_LIMIT_CHAT = max(1, int(os.getenv("RATE_LIMIT_CHAT", "30")))
RATE_LIMIT_VOICE = max(1, int(os.getenv("RATE_LIMIT_VOICE", "30")))
RATE_LIMIT_ADMIN = max(1, int(os.getenv("RATE_LIMIT_ADMIN", "120")))
RATE_LIMIT_DEFAULT = max(1, int(os.getenv("RATE_LIMIT_DEFAULT", "240")))

VOICE_NOTICE = (
    "ASR/TTS Qwen hanya aktif bila DASHSCOPE_API_KEY dan QWEN_BASE_URL diisi di backend. "
    "Tanpa kunci, suara memakai fallback demo yang jujur ditandai di UI: "
    "SAPI Windows untuk bahasa Inggris dan suara browser untuk bahasa Indonesia."
)

DEMO_TTS_NOTICE = (
    "Suara demo dihasilkan Windows SAPI di server (bukan Qwen TTS). "
    "Kualitas dan dukungan bahasa mengikuti suara yang terpasang di mesin server."
)
