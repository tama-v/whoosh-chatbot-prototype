"""pgvector-backed chunk vector store.

Relational demo data lives in SQLite; this module keeps only chunk embeddings in
PostgreSQL so retrieval can use pgvector similarity search. When PostgreSQL is
unreachable (or VECTOR_STORE=sqlite), the app transparently falls back to the
SQLite embedding blobs that ship with the demo database.
"""

import logging
import math
import sqlite3
import time
from typing import Any, Iterable

from app.core.config import PGVECTOR_DSN, VECTOR_DIMS, VECTOR_STORE_MODE

logger = logging.getLogger("whoosh_ai.vector_store")

try:  # psycopg is optional so the SQLite-only demo still starts without it.
    import psycopg
except Exception:  # pragma: no cover - exercised only when the driver is missing
    psycopg = None

_state: dict[str, Any] = {
    "checked": False,
    "available": False,
    "reason": "belum diperiksa",
}

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS chunk_vectors (
    chunk_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL,
    embedding vector({dims}) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
"""

INDEX_SQL = (
    "CREATE INDEX IF NOT EXISTS idx_chunk_vectors_document ON chunk_vectors(document_id)",
    "CREATE INDEX IF NOT EXISTS idx_chunk_vectors_model ON chunk_vectors(model)",
    "CREATE INDEX IF NOT EXISTS idx_chunk_vectors_embedding ON chunk_vectors USING hnsw (embedding vector_cosine_ops)",
)


def _mark(available: bool, reason: str) -> None:
    _state["checked"] = True
    _state["available"] = available
    _state["reason"] = reason


def _connect():
    if psycopg is None:
        raise RuntimeError("driver psycopg belum terpasang")
    return psycopg.connect(PGVECTOR_DSN, connect_timeout=6, autocommit=True)


def _pad(vector: Iterable[float]) -> list[float]:
    values = [float(value) for value in vector]
    if len(values) == VECTOR_DIMS:
        return values
    if len(values) > VECTOR_DIMS:
        values = values[:VECTOR_DIMS]
    else:
        values.extend([0.0] * (VECTOR_DIMS - len(values)))
    norm = math.sqrt(sum(value * value for value in values))
    if norm:
        values = [value / norm for value in values]
    return values


def _literal(vector: Iterable[float]) -> str:
    return "[" + ",".join(f"{value:.6f}" for value in _pad(vector)) + "]"


def _table_dims(conn) -> int | None:
    row = conn.execute(
        """SELECT format_type(a.atttypid, a.atttypmod) AS type
           FROM pg_attribute a
           JOIN pg_class c ON c.oid = a.attrelid
           WHERE c.relname = 'chunk_vectors' AND a.attname = 'embedding'
             AND a.attnum > 0 AND NOT a.attisdropped"""
    ).fetchone()
    if not row:
        return None
    raw = str(row[0])
    if "(" not in raw:
        return None
    try:
        return int(raw.split("(", 1)[1].rstrip(")"))
    except ValueError:
        return None


def _ensure_schema(conn) -> None:
    conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
    conn.execute(SCHEMA_SQL.format(dims=VECTOR_DIMS))
    dims = _table_dims(conn)
    if dims is not None and dims != VECTOR_DIMS:
        # Embedding dimension changed between runs; rebuild the vector table.
        conn.execute("DROP TABLE chunk_vectors")
        conn.execute(SCHEMA_SQL.format(dims=VECTOR_DIMS))
    for statement in INDEX_SQL:
        conn.execute(statement)


def ensure_ready() -> bool:
    """Open a connection, create the pgvector schema, and cache availability."""
    if VECTOR_STORE_MODE == "sqlite":
        _mark(False, "dinonaktifkan (VECTOR_STORE=sqlite)")
        return False
    if _state["checked"] and _state["available"]:
        return True
    try:
        for attempt in range(2):
            try:
                with _connect() as conn:
                    _ensure_schema(conn)
                break
            except Exception:
                # Docker's port proxy on Windows can stall the first attempt.
                if attempt == 1:
                    raise
                time.sleep(0.5)
        _mark(True, "pgvector siap")
        return True
    except Exception as exc:  # connection refused, extension missing, auth error
        _mark(False, f"pgvector tidak tersedia: {exc.__class__.__name__}")
        logger.warning("pgvector tidak tersedia, memakai fallback SQLite: %s", exc)
        return False


def available() -> bool:
    if VECTOR_STORE_MODE == "sqlite":
        return False
    if not _state["checked"] or not _state["available"]:
        return ensure_ready()
    return True


def reset() -> None:
    _state.update({"checked": False, "available": False, "reason": "belum diperiksa"})


def _upsert(conn, items: list[dict[str, Any]]) -> None:
    if not items:
        return
    with conn.cursor() as cursor:
        cursor.executemany(
            """INSERT INTO chunk_vectors (chunk_id, document_id, title, section, content, model, embedding, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s::vector, now())
               ON CONFLICT (chunk_id) DO UPDATE SET
                 document_id = excluded.document_id,
                 title = excluded.title,
                 section = excluded.section,
                 content = excluded.content,
                 model = excluded.model,
                 embedding = excluded.embedding,
                 updated_at = now()""",
            [
                (
                    item["chunk_id"],
                    item["document_id"],
                    item.get("title") or "",
                    item.get("section") or "",
                    item.get("content") or "",
                    item["model"],
                    _literal(item["vector"]),
                )
                for item in items
            ],
        )


def _prune(conn, keep_ids: list[str]) -> int:
    if keep_ids:
        cursor = conn.execute(
            "DELETE FROM chunk_vectors WHERE NOT (chunk_id = ANY(%s))", (keep_ids,)
        )
    else:
        cursor = conn.execute("DELETE FROM chunk_vectors")
    return cursor.rowcount


def sync_from_sqlite(conn: sqlite3.Connection) -> dict[str, Any]:
    """Mirror SQLite chunk embeddings into pgvector (idempotent upsert)."""
    if not available():
        return {"synced": 0, "backend": "sqlite", "reason": _state["reason"]}
    from app.services.rag.embeddings import unpack_vector

    rows = conn.execute(
        """SELECT e.chunk_id, e.model, e.vector, c.document_id, c.section, c.content,
                  d.title, d.status
           FROM chunk_embeddings e
           JOIN document_chunks c ON c.id = e.chunk_id
           JOIN documents d ON d.id = c.document_id
           WHERE d.status = 'processed'"""
    ).fetchall()
    items = [
        {
            "chunk_id": row["chunk_id"],
            "document_id": row["document_id"],
            "title": row["title"],
            "section": row["section"],
            "content": row["content"],
            "model": row["model"],
            "vector": unpack_vector(row["vector"]),
        }
        for row in rows
    ]
    try:
        with _connect() as connection:
            _upsert(connection, items)
            removed = _prune(connection, [item["chunk_id"] for item in items])
        return {
            "synced": len(items),
            "removed": removed,
            "backend": "pgvector",
            "reason": "ok",
        }
    except Exception as exc:
        _mark(False, f"pgvector gagal sinkron: {exc.__class__.__name__}")
        logger.warning("Sinkronisasi pgvector gagal: %s", exc)
        return {"synced": 0, "backend": "sqlite", "reason": _state["reason"]}


def delete_document(document_id: str) -> None:
    if not available():
        return
    try:
        with _connect() as conn:
            conn.execute("DELETE FROM chunk_vectors WHERE document_id = %s", (document_id,))
    except Exception as exc:
        _mark(False, f"pgvector gagal menghapus: {exc.__class__.__name__}")
        logger.warning("Hapus vektor pgvector gagal: %s", exc)


def preferred_model() -> str | None:
    if not available():
        return None
    try:
        with _connect() as conn:
            row = conn.execute(
                "SELECT model FROM chunk_vectors GROUP BY model ORDER BY MAX(updated_at) DESC LIMIT 1"
            ).fetchone()
        return row[0] if row else None
    except Exception:
        return None


def similar(vector: Iterable[float], model: str, limit: int = 40) -> list[tuple[str, float]]:
    """Cosine similarity search. Returns (chunk_id, similarity) ordered best-first."""
    if not available():
        return []
    literal = _literal(vector)
    try:
        with _connect() as conn:
            rows = conn.execute(
                """SELECT chunk_id, 1 - (embedding <=> %s::vector) AS score
                   FROM chunk_vectors
                   WHERE model = %s
                   ORDER BY embedding <=> %s::vector
                   LIMIT %s""",
                (literal, model, literal, max(1, limit)),
            ).fetchall()
        return [(row[0], float(row[1])) for row in rows]
    except Exception as exc:
        _mark(False, f"pgvector gagal query: {exc.__class__.__name__}")
        logger.warning("Query pgvector gagal: %s", exc)
        return []


def stats() -> dict[str, Any]:
    if not available():
        return {
            "backend": "sqlite",
            "available": False,
            "reason": _state["reason"],
            "dims": None,
        }
    try:
        with _connect() as conn:
            total = conn.execute("SELECT COUNT(*) FROM chunk_vectors").fetchone()[0]
            models = {
                row[0]: row[1]
                for row in conn.execute(
                    "SELECT model, COUNT(*) FROM chunk_vectors GROUP BY model"
                ).fetchall()
            }
        return {
            "backend": "pgvector",
            "available": True,
            "reason": "ok",
            "dims": VECTOR_DIMS,
            "chunks": total,
            "models": models,
        }
    except Exception as exc:
        _mark(False, f"pgvector gagal statistik: {exc.__class__.__name__}")
        return {
            "backend": "sqlite",
            "available": False,
            "reason": _state["reason"],
            "dims": None,
        }
