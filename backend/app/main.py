import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin, auth, chat, complaints, documents, voice
from app.core.config import (
    AI_CONFIGURED,
    APP_NAME,
    QWEN_CHAT_MODEL,
    QWEN_EMBEDDING_MODEL,
)
from app.core.rate_limit import RateLimitMiddleware
from app.database.db import init_db
from app.services.voice.service import health_payload as voice_health_payload

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=f"{APP_NAME} API",
    description="Demo modular-monolith API for the Whoosh AI passenger assistant prototype.",
    version="0.1.0",
    lifespan=lifespan,
)

origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,"
    "http://localhost:8081,http://127.0.0.1:8081,"
    "http://localhost:19006,http://127.0.0.1:19006",
).split(",")

app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins if origin.strip()],
    # Expo web picks a new port when 8081 is busy (8082, 8083, ...).
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=[
        "X-Voice-Provider",
        "X-Voice-Model",
        "X-Voice-Cached",
        "X-Voice-Notice",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "Retry-After",
    ],
)

for router in (auth.router, chat.router, voice.router, complaints.router, documents.router, admin.router):
    app.include_router(router, prefix="/api/v1")


@app.get("/")
def root() -> dict:
    return {
        "name": APP_NAME,
        "status": "ok",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


@app.get("/api/v1/health")
def health() -> dict:
    return {
        "status": "ok",
        "mode": "qwen" if AI_CONFIGURED else "demo",
        "model": QWEN_CHAT_MODEL if AI_CONFIGURED else None,
        "embedding_model": QWEN_EMBEDDING_MODEL if AI_CONFIGURED else None,
        "retrieval": "hybrid-rrf (FTS5 + lexical + vector)",
        "qwen_configured": AI_CONFIGURED,
        "voice": voice_health_payload(),
        "demo_notice": (
            "Mode demo aktif: jawaban berasal dari knowledge base demo dan bukan layanan resmi operator. "
            "Konfigurasi Qwen di backend untuk mengaktifkan mode model."
            if not AI_CONFIGURED
            else "Mode Qwen aktif. Tetap verifikasi konfigurasi model dan endpoint pada dokumentasi resmi."
        ),
    }
