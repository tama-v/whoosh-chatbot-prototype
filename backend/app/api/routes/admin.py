from datetime import timedelta

from fastapi import APIRouter, Depends, Query

from app.core.config import (
    AI_CONFIGURED,
    QWEN_CHAT_MODEL,
    QWEN_EMBEDDING_MODEL,
    QWEN_TTS_MODEL,
    QWEN_ASR_MODEL,
)
from app.core.security import AuthUser, require_admin
from app.database.db import get_conn, utcnow
from app.services.rag.knowledge import refresh_embeddings, retrieval_stats, retrieve_with_trace
from app.services.rag import vector_store
from app.services.voice.service import health_payload as voice_health_payload

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)

NEGATIVE_WORDS = ("lambat", "telat", "rusak", "jelek", "kecewa", "hilang", "batal", "salah", "kurang", "tidak", "mahal", "kotor")
POSITIVE_WORDS = ("terima kasih", "bagus", "nyaman", "cepat", "puas", "suka", "membantu", "baik")


@router.get("/analytics")
def analytics() -> dict:
    with get_conn() as conn:
        conversations = conn.execute("SELECT COUNT(*) AS n FROM conversations").fetchone()["n"]
        messages = conn.execute("SELECT COUNT(*) AS n FROM messages").fetchone()["n"]
        complaints = conn.execute("SELECT COUNT(*) AS n FROM complaints").fetchone()["n"]
        open_complaints = conn.execute(
            "SELECT COUNT(*) AS n FROM complaints WHERE status IN ('submitted_to_demo_system', 'under_review')"
        ).fetchone()["n"]
        resolved_complaints = conn.execute(
            "SELECT COUNT(*) AS n FROM complaints WHERE status IN ('resolved', 'closed')"
        ).fetchone()["n"]
        documents = conn.execute("SELECT COUNT(*) AS n FROM documents").fetchone()["n"]
        chunks = conn.execute("SELECT COUNT(*) AS n FROM document_chunks").fetchone()["n"]
        by_status = conn.execute(
            "SELECT status, COUNT(*) AS count FROM complaints GROUP BY status ORDER BY count DESC"
        ).fetchall()
        by_category = conn.execute(
            "SELECT category, COUNT(*) AS count FROM complaints GROUP BY category ORDER BY count DESC"
        ).fetchall()
        trend_rows = conn.execute(
            """SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
               FROM conversations GROUP BY day ORDER BY day DESC LIMIT 14"""
        ).fetchall()
        top_questions = conn.execute(
            """SELECT content, COUNT(*) AS count FROM messages
               WHERE role = 'user' GROUP BY content ORDER BY count DESC, content ASC LIMIT 6"""
        ).fetchall()
        unanswered = conn.execute(
            """SELECT COUNT(*) AS n FROM messages
               WHERE role = 'assistant' AND (content LIKE '%belum menemukan%' OR content LIKE '%could not find%')"""
        ).fetchone()["n"]
        user_messages = [row["content"].lower() for row in conn.execute(
            "SELECT content FROM messages WHERE role = 'user'"
        ).fetchall()]

    positive = sum(1 for text in user_messages if any(word in text for word in POSITIVE_WORDS))
    negative = sum(1 for text in user_messages if any(word in text for word in NEGATIVE_WORDS))
    neutral = max(0, len(user_messages) - positive - negative)
    total_sentiment = max(1, positive + negative + neutral)

    trend_map = {row["day"]: row["count"] for row in trend_rows}
    today = utcnow().date()
    trend = []
    for offset in range(6, -1, -1):
        day = (today - timedelta(days=offset)).isoformat()
        trend.append({"date": day, "count": trend_map.get(day, 0)})

    return {
        "demo": True,
        "ai_mode": "qwen" if AI_CONFIGURED else "demo",
        "retrieval": retrieval_stats(),
        "voice": voice_health_payload(),
        "overview": {
            "conversations": conversations,
            "messages": messages,
            "complaints": complaints,
            "open_complaints": open_complaints,
            "resolved_complaints": resolved_complaints,
            "documents": documents,
            "chunks": chunks,
        },
        "complaints_by_status": [dict(row) for row in by_status],
        "complaints_by_category": [dict(row) for row in by_category],
        "trend": trend,
        "top_questions": [dict(row) for row in top_questions],
        "unanswered": unanswered,
        "sentiment": {
            "positive": round(positive / total_sentiment * 100),
            "neutral": round(neutral / total_sentiment * 100),
            "negative": round(negative / total_sentiment * 100),
            "demo": True,
        },
        "notice": "Angka dihitung dari database demo SQLite, bukan data operator.",
    }


@router.get("/complaints")
def admin_complaints(
    category: str | None = None,
    status: str | None = None,
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
) -> dict:
    where = ["1=1"]
    params: list = []
    if category:
        where.append("category = ?")
        params.append(category)
    if status:
        where.append("status = ?")
        params.append(status)
    if q:
        where.append("(ticket_number LIKE ? OR description LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%"])
    clause = " AND ".join(where)
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM complaints WHERE {clause} ORDER BY created_at DESC LIMIT ?",
            [*params, limit],
        ).fetchall()
    from app.api.routes.complaints import _serialize

    return {"items": [_serialize(row) for row in rows], "demo": True}


@router.get("/retrieval/test")
def retrieval_test(q: str = Query(default="", max_length=500), language: str = Query(default="id")) -> dict:
    if language not in {"id", "en"}:
        language = "id"
    if not q.strip():
        return {"hits": [], "trace": {}, "query": q, "demo": True}
    hits, trace = retrieve_with_trace(q.strip(), language=language)
    return {
        "query": q.strip(),
        "language": language,
        "hits": [
            {
                "document_id": hit.document_id,
                "document_title": hit.document_title,
                "section": hit.section,
                "language": hit.document_language,
                "score": hit.score,
                "sources": hit.sources,
                "raw": hit.raw,
                "preview": hit.content[:260],
            }
            for hit in hits
        ],
        "trace": trace,
        "demo": True,
    }


@router.post("/embeddings/refresh")
def embeddings_refresh() -> dict:
    result = refresh_embeddings()
    return {**result, "retrieval": retrieval_stats(), "demo": True}


@router.get("/health")
def admin_health(admin: AuthUser = Depends(require_admin)) -> dict:
    with get_conn() as conn:
        ok = conn.execute("SELECT 1").fetchone()
        version = conn.execute("SELECT MAX(version) AS v FROM schema_migrations").fetchone()["v"]
    return {"ok": bool(ok), "user_scope": admin.email, "schema_version": version}


@router.get("/system")
def admin_system(admin: AuthUser = Depends(require_admin)) -> dict:
    """Detailed runtime diagnostics. Admin-only; never exposed to passengers."""
    return {
        "user_scope": admin.email,
        "ai": {
            "mode": "qwen" if AI_CONFIGURED else "demo",
            "chat_model": QWEN_CHAT_MODEL if AI_CONFIGURED else None,
            "embedding_model": QWEN_EMBEDDING_MODEL if AI_CONFIGURED else None,
            "asr_model": QWEN_ASR_MODEL if AI_CONFIGURED else None,
            "tts_model": QWEN_TTS_MODEL if AI_CONFIGURED else None,
        },
        "retrieval": retrieval_stats(),
        "vector_store": vector_store.stats(),
        "voice": voice_health_payload(),
    }
