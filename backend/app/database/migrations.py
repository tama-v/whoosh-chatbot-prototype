"""Lightweight, idempotent SQLite migrations.

The demo ships with SQLite so it runs offline. Schema changes are applied at
startup and recorded in schema_migrations, so an existing demo database keeps
working after an upgrade.
"""

import sqlite3
from datetime import datetime, timezone

MIGRATIONS: list[tuple[int, str]] = [(2, "hybrid retrieval index"), (3, "self-hosted users and sessions")]


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def _add_column(conn: sqlite3.Connection, table: str, column: str, spec: str) -> None:
    if column not in _columns(conn, table):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {spec}")


def fts_available(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE name = 'chunk_fts' AND type = 'table'"
    ).fetchone()
    return bool(row)


def rebuild_fts(conn: sqlite3.Connection, document_id: str | None = None) -> int:
    if not fts_available(conn):
        return 0
    if document_id:
        conn.execute("DELETE FROM chunk_fts WHERE document_id = ?", (document_id,))
        where = "WHERE c.document_id = ? AND d.status = 'processed'"
        params = (document_id,)
    else:
        conn.execute("DELETE FROM chunk_fts")
        where = "WHERE d.status = 'processed'"
        params = ()
    cursor = conn.execute(
        f"""INSERT INTO chunk_fts (chunk_id, document_id, title, section, content)
            SELECT c.id, c.document_id, d.title, COALESCE(c.section, ''), c.content
            FROM document_chunks c JOIN documents d ON d.id = c.document_id
            {where}""",
        params,
    )
    return cursor.rowcount


def _backfill_embeddings(conn: sqlite3.Connection) -> int:
    from app.services.rag.embeddings import HASHED_MODEL, hashed_embedding, pack_vector

    rows = conn.execute(
        """SELECT c.id, c.content FROM document_chunks c
           LEFT JOIN chunk_embeddings e ON e.chunk_id = c.id
           WHERE e.chunk_id IS NULL"""
    ).fetchall()
    now = datetime.now(timezone.utc).isoformat()
    for row in rows:
        vector = hashed_embedding(row["content"])
        conn.execute(
            """INSERT INTO chunk_embeddings (chunk_id, model, dims, vector, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(chunk_id) DO UPDATE SET model=excluded.model, dims=excluded.dims,
                 vector=excluded.vector, updated_at=excluded.updated_at""",
            (row["id"], HASHED_MODEL, len(vector), pack_vector(vector), now),
        )
    return len(rows)


def _migration_v2(conn: sqlite3.Connection) -> None:
    _add_column(conn, "documents", "language", "TEXT NOT NULL DEFAULT 'id'")
    _add_column(conn, "messages", "mode", "TEXT")
    _add_column(conn, "messages", "retrieval_trace", "TEXT")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS chunk_embeddings (
            chunk_id TEXT PRIMARY KEY REFERENCES document_chunks(id) ON DELETE CASCADE,
            model TEXT NOT NULL,
            dims INTEGER NOT NULL,
            vector BLOB NOT NULL,
            updated_at TEXT NOT NULL
        )"""
    )
    try:
        conn.execute(
            """CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
                chunk_id UNINDEXED,
                document_id UNINDEXED,
                title,
                section,
                content,
                tokenize = 'unicode61 remove_diacritics 2'
            )"""
        )
    except sqlite3.OperationalError:
        # FTS5 is optional; retrieval falls back to lexical + vector scoring.
        pass
    rebuild_fts(conn)
    _backfill_embeddings(conn)


def _migration_v3(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL COLLATE NOCASE UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'passenger' CHECK(role IN ('passenger', 'admin')),
            created_at TEXT NOT NULL,
            last_login_at TEXT
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            last_used_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
        """
    )


def apply_migrations(conn: sqlite3.Connection) -> list[int]:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        )"""
    )
    applied = {row["version"] for row in conn.execute("SELECT version FROM schema_migrations").fetchall()}
    executed: list[int] = []
    now = datetime.now(timezone.utc).isoformat()
    for version, _label in MIGRATIONS:
        if version in applied:
            continue
        if version == 2:
            _migration_v2(conn)
        elif version == 3:
            _migration_v3(conn)
        conn.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", (version, now))
        executed.append(version)
    return executed
