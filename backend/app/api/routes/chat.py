import asyncio
import json
import logging
import re
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.core.config import AI_CONFIGURED, MAX_HISTORY_MESSAGES, SOCIAL_LLM_TIMEOUT
from app.core.security import Actor, get_actor
from app.database.db import get_conn, now_iso
from app.schemas import ChatRequest
from app.services.ai.qwen_provider import (
    complete_qwen,
    complete_social,
    stream_qwen,
    stream_social,
)
from app.services.rag.knowledge import (
    build_demo_answer,
    build_guidance_answer,
    build_social_answer,
    detect_guidance_intent,
    detect_social_intent,
    is_followup,
    last_topic_question,
    retrieve_with_trace,
    select_demo_hits,
)

logger = logging.getLogger("whoosh_ai.chat")
router = APIRouter(tags=["chat"])


def _citation_list(focused) -> list[dict]:
    seen: set[str] = set()
    citations = []
    for hit in focused:
        if hit.document_id in seen:
            continue
        seen.add(hit.document_id)
        citations.append(hit.citation)
    return citations


def _retrieve(
    question: str, history: list[dict[str, str]], language: str
) -> tuple[list, dict]:
    """Retrieve for the question; follow-ups are anchored to the previous topic."""
    previous = last_topic_question(history) if is_followup(question) else None
    if previous:
        hits, trace = retrieve_with_trace(previous, language=language)
        trace = dict(trace)
        trace["strategy"] = "followup-context"
        trace["followup_from"] = question
        trace["followup_anchor"] = previous
        return hits, trace
    return retrieve_with_trace(question, language=language)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _get_or_create_conversation(
    conversation_id: str | None, title: str, language: str, actor: Actor
) -> str:
    with get_conn() as conn:
        if conversation_id:
            placeholders = ",".join("?" for _ in actor.scope_ids)
            row = conn.execute(
                f"SELECT id FROM conversations WHERE id = ? AND user_id IN ({placeholders})",
                (conversation_id, *actor.scope_ids),
            ).fetchone()
            if row:
                conn.execute(
                    "UPDATE conversations SET updated_at = ?, language = ? WHERE id = ?",
                    (now_iso(), language, conversation_id),
                )
                return conversation_id
        new_id = str(uuid.uuid4())
        clean_title = re.sub(r"\s+", " ", title).strip()[:80] or "Percakapan baru"
        timestamp = now_iso()
        conn.execute(
            "INSERT INTO conversations (id, user_id, title, language, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (new_id, actor.actor_id, clean_title, language, timestamp, timestamp),
        )
        return new_id


def _history(conversation_id: str) -> list[dict[str, str]]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT role, content FROM messages
               WHERE conversation_id = ? AND role IN ('user', 'assistant')
               ORDER BY created_at DESC LIMIT ?""",
            (conversation_id, MAX_HISTORY_MESSAGES),
        ).fetchall()
    return [{"role": row["role"], "content": row["content"]} for row in reversed(rows)]


def _save_message(
    message_id: str,
    conversation_id: str,
    role: str,
    content: str,
    citations: list[dict],
    input_type: str = "text",
    mode: str | None = None,
    retrieval_trace: dict | None = None,
) -> None:
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO messages
                 (id, conversation_id, role, content, input_type, citations, mode, retrieval_trace, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                message_id,
                conversation_id,
                role,
                content,
                input_type,
                json.dumps(citations, ensure_ascii=False),
                mode,
                json.dumps(retrieval_trace, ensure_ascii=False) if retrieval_trace else None,
                now_iso(),
            ),
        )
        conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now_iso(), conversation_id))


async def _demo_stream(text: str) -> AsyncIterator[str]:
    words = re.findall(r"\S+\s*", text)
    for index in range(0, len(words), 4):
        yield "".join(words[index:index + 4])
        await asyncio.sleep(0.012)


@router.post("/chat/stream")
async def chat_stream(payload: ChatRequest, actor: Actor = Depends(get_actor)) -> StreamingResponse:
    question = payload.message.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Pesan tidak boleh kosong")

    conversation_id = _get_or_create_conversation(
        payload.conversation_id, question, payload.language, actor
    )
    history = _history(conversation_id)
    social_intent = detect_social_intent(question, payload.language)
    guidance_intent = None if social_intent else detect_guidance_intent(question)
    social_anchor = None
    if social_intent or guidance_intent:
        hits, retrieval_trace = [], {
            "strategy": "social" if social_intent else guidance_intent,
            "answerable": True,
        }
        if social_intent:
            retrieval_trace["social_intent"] = social_intent
            social_anchor = last_topic_question(history) if social_intent == "meta" else None
            demo_answer = build_social_answer(social_intent, payload.language, social_anchor)
        else:
            demo_answer = build_guidance_answer(guidance_intent or "", payload.language)
        context = ""
        citations = []
    else:
        hits, retrieval_trace = _retrieve(question, history, payload.language)
        answer_question = retrieval_trace.get("followup_anchor") or question
        context = "\n\n---\n\n".join(
            f"[{hit.document_title} | {hit.section or 'Umum'}]\n{hit.content}" for hit in hits
        )
        demo_answer = build_demo_answer(answer_question, hits, payload.language)
        citations = _citation_list(select_demo_hits(answer_question, hits, payload.language)[0])
    user_message_id = str(uuid.uuid4())
    assistant_message_id = str(uuid.uuid4())
    _save_message(user_message_id, conversation_id, "user", question, [], input_type=payload.input_type)

    async def event_stream() -> AsyncIterator[str]:
        parts: list[str] = []
        if social_intent or guidance_intent:
            mode = "conversational"
        elif hits:
            mode = "qwen" if AI_CONFIGURED else "demo"
        else:
            mode = "no-evidence"
        yield _sse(
            {
                "type": "meta",
                "conversation_id": conversation_id,
                "user_message_id": user_message_id,
                "message_id": assistant_message_id,
                "mode": mode,
                "retrieval": {
                    "strategy": retrieval_trace.get("strategy"),
                    "answerable": retrieval_trace.get("answerable"),
                    "hits": len(hits),
                    "sources": sorted({source for hit in hits for source in hit.sources}),
                },
            }
        )
        try:
            if AI_CONFIGURED and social_intent:
                try:
                    async for delta in stream_social(
                        question,
                        [] if social_intent == "meta" else history,
                        payload.language,
                        social_anchor,
                        demo_answer,
                    ):
                        parts.append(delta)
                        yield _sse({"type": "delta", "text": delta})
                except Exception:
                    logger.exception(
                        "Qwen social streaming failed, falling back to template answer"
                    )
            if AI_CONFIGURED and hits:
                try:
                    async for delta in stream_qwen(question, context, history, payload.language):
                        parts.append(delta)
                        yield _sse({"type": "delta", "text": delta})
                except Exception:
                    logger.exception("Qwen streaming failed, falling back to demo answer")
                    mode = "demo-fallback"
            if not parts:
                async for delta in _demo_stream(demo_answer):
                    parts.append(delta)
                    yield _sse({"type": "delta", "text": delta})
            final_text = "".join(parts).strip() or demo_answer
            _save_message(
                assistant_message_id,
                conversation_id,
                "assistant",
                final_text,
                citations,
                mode=mode,
                retrieval_trace=retrieval_trace,
            )
            yield _sse({"type": "citations", "citations": citations})
            yield _sse({"type": "done", "mode": mode})
        except Exception:
            logger.exception("Chat stream failed")
            yield _sse(
                {
                    "type": "error",
                    "message": "Terjadi gangguan saat memproses jawaban. Silakan coba lagi.",
                }
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chat")
async def chat_once(payload: ChatRequest, actor: Actor = Depends(get_actor)) -> dict:
    question = payload.message.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Pesan tidak boleh kosong")

    conversation_id = _get_or_create_conversation(
        payload.conversation_id, question, payload.language, actor
    )
    history = _history(conversation_id)
    social_intent = detect_social_intent(question, payload.language)
    guidance_intent = None if social_intent else detect_guidance_intent(question)
    social_anchor = None
    if social_intent or guidance_intent:
        hits, retrieval_trace = [], {
            "strategy": "social" if social_intent else guidance_intent,
            "answerable": True,
        }
        if social_intent:
            retrieval_trace["social_intent"] = social_intent
            social_anchor = last_topic_question(history) if social_intent == "meta" else None
            answer = build_social_answer(social_intent, payload.language, social_anchor)
        else:
            answer = build_guidance_answer(guidance_intent or "", payload.language)
        mode = "conversational"
        citations = []
    else:
        hits, retrieval_trace = _retrieve(question, history, payload.language)
        answer_question = retrieval_trace.get("followup_anchor") or question
        context = "\n\n---\n\n".join(
            f"[{hit.document_title} | {hit.section or 'Umum'}]\n{hit.content}" for hit in hits
        )
        answer = build_demo_answer(answer_question, hits, payload.language)
        citations = _citation_list(select_demo_hits(answer_question, hits, payload.language)[0])
        if hits:
            mode = "qwen" if AI_CONFIGURED else "demo"
        else:
            mode = "no-evidence"
        if AI_CONFIGURED and hits:
            try:
                answer = await complete_qwen(question, context, history, payload.language)
            except Exception:
                logger.exception("Qwen completion failed, falling back to demo answer")
                mode = "demo-fallback"

    if AI_CONFIGURED and social_intent:
        template_answer = answer
        try:
            answer = await asyncio.wait_for(
                complete_social(
                    question,
                    [] if social_intent == "meta" else history,
                    payload.language,
                    social_anchor,
                    template_answer,
                ),
                timeout=SOCIAL_LLM_TIMEOUT,
            )
        except Exception:
            logger.exception(
                "Qwen social completion failed, falling back to template answer"
            )

    user_message_id = str(uuid.uuid4())
    assistant_message_id = str(uuid.uuid4())
    _save_message(user_message_id, conversation_id, "user", question, [], input_type=payload.input_type)
    _save_message(
        assistant_message_id,
        conversation_id,
        "assistant",
        answer,
        citations,
        mode=mode,
        retrieval_trace=retrieval_trace,
    )
    return {
        "conversation_id": conversation_id,
        "user_message_id": user_message_id,
        "message_id": assistant_message_id,
        "answer": answer,
        "citations": citations,
        "mode": mode,
        "retrieval": {
            "strategy": retrieval_trace.get("strategy"),
            "answerable": retrieval_trace.get("answerable"),
            "hits": len(hits),
            "sources": sorted({source for hit in hits for source in hit.sources}),
        },
    }


@router.get("/conversations")
def list_conversations(
    limit: int = Query(default=20, ge=1, le=100), actor: Actor = Depends(get_actor)
) -> dict:
    placeholders = ",".join("?" for _ in actor.scope_ids)
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT c.*,
                 (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
                 (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
               FROM conversations c
               WHERE c.user_id IN ({placeholders})
               ORDER BY c.updated_at DESC LIMIT ?""",
            (*actor.scope_ids, limit),
        ).fetchall()
    return {"items": [dict(row) for row in rows], "demo": True}


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, actor: Actor = Depends(get_actor)) -> dict:
    placeholders = ",".join("?" for _ in actor.scope_ids)
    with get_conn() as conn:
        row = conn.execute(
            f"SELECT * FROM conversations WHERE id = ? AND user_id IN ({placeholders})",
            (conversation_id, *actor.scope_ids),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan")
    return dict(row)


@router.get("/conversations/{conversation_id}/messages")
def list_messages(conversation_id: str, actor: Actor = Depends(get_actor)) -> dict:
    placeholders = ",".join("?" for _ in actor.scope_ids)
    with get_conn() as conn:
        conversation = conn.execute(
            f"SELECT id FROM conversations WHERE id = ? AND user_id IN ({placeholders})",
            (conversation_id, *actor.scope_ids),
        ).fetchone()
        if not conversation:
            raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan")
        rows = conn.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conversation_id,),
        ).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        item["citations"] = json.loads(item.get("citations") or "[]")
        items.append(item)
    return {"items": items}
