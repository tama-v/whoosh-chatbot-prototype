import json
import logging
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

from app.core.config import DB_PATH, DEMO_USER_ID

logger = logging.getLogger("whoosh_ai.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processed',
    uploaded_by TEXT NOT NULL DEFAULT 'system',
    chunk_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    page_number INTEGER,
    section TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'id',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    input_type TEXT NOT NULL DEFAULT 'text',
    audio_metadata TEXT,
    citations TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    ticket_number TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'submitted_to_demo_system',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

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

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
"""


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return utcnow().isoformat()


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _seed_conversations(conn: sqlite3.Connection) -> None:
    count = conn.execute("SELECT COUNT(*) AS n FROM conversations").fetchone()["n"]
    if count:
        return

    topics = [
        ("Bagaimana cara boarding Whoosh?", "Bagaimana cara boarding Whoosh?", "Proses boarding dimulai dengan tiba lebih awal di stasiun, menyiapkan dokumen perjalanan, lalu mengikuti pemeriksaan dan arahan petugas menuju gate keberangkatan. Ikuti papan informasi serta pengumuman resmi di stasiun.", "boarding"),
        ("Apa saja ketentuan bagasi?", "Apa saja ketentuan bagasi?", "Ketentuan bagasi mengikuti jenis tiket dan informasi resmi Whoosh. Pastikan barang bawaan tidak termasuk daftar barang terlarang dan simpan barang berharga di kabin.", "bagasi"),
        ("Bagaimana cara mengubah jadwal tiket?", "Bagaimana cara mengubah jadwal tiket?", "Perubahan jadwal perlu dilakukan melalui kanal resmi penjualan tiket. Syarat, biaya, dan ketersediaan mengikuti ketentuan tiket yang berlaku.", "tiket"),
        ("Prosedur pembatalan tiket", "Prosedur pembatalan tiket", "Pembatalan dilakukan melalui kanal resmi tempat tiket dibeli. Periksa ketentuan refund dan waktu pembatalan pada tiket Anda.", "tiket"),
        ("Fasilitas apa saja yang ada di stasiun?", "Fasilitas apa saja yang ada di stasiun?", "Stasiun umumnya menyediakan area tunggu, toilet, layanan pelanggan, dan fasilitas aksesibilitas. Lokasi fasilitas dapat ditanyakan kepada petugas stasiun.", "stasiun"),
        ("Bagaimana melaporkan barang tertinggal?", "Bagaimana melaporkan barang tertinggal?", "Segera hubungi petugas stasiun atau layanan pelanggan resmi. Siapkan deskripsi barang, waktu, dan lokasi terakhir agar pencarian lebih mudah.", "lost"),
        ("Apakah anak boleh naik tanpa tiket?", "Apakah anak boleh naik tanpa tiket?", "Saya belum menemukan aturan tersebut pada knowledge base demo. Silakan verifikasi ketentuan usia dan tiket anak melalui kanal resmi operator.", "unanswered"),
        ("Bagaimana cara membuat laporan keluhan?", "Bagaimana cara membuat laporan keluhan?", "Laporan dapat dibuat melalui Complaint Assistant di aplikasi ini. Pilih kategori, jelaskan kronologi, lalu konfirmasi ringkasan. Laporan pada prototype ini adalah simulasi internal, bukan tiket resmi operator.", "keluhan"),
    ]
    for idx, (title, question, answer, tag) in enumerate(topics):
        created = utcnow() - timedelta(days=(len(topics) - idx) % 7, hours=idx * 2)
        cid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO conversations (id, user_id, title, language, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (cid, DEMO_USER_ID, title, "id", created.isoformat(), created.isoformat()),
        )
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, input_type, citations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), cid, "user", question, "text", "[]", created.isoformat()),
        )
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, input_type, citations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                cid,
                "assistant",
                answer,
                "text",
                json.dumps([], ensure_ascii=False),
                (created + timedelta(seconds=12)).isoformat(),
            ),
        )


def _seed_complaints(conn: sqlite3.Connection) -> None:
    count = conn.execute("SELECT COUNT(*) AS n FROM complaints").fetchone()["n"]
    if count:
        return
    demos = [
        ("lost_and_found", "Tas kecil tertinggal di area tunggu Gate 2 setelah keberangkatan.", "high", "under_review", {"station": "Stasiun Halim", "demo": True}),
        ("ticket_issue", "Nama pada tiket tidak sesuai dengan identitas yang akan digunakan.", "medium", "submitted_to_demo_system", {"station": "Stasiun Padalarang", "demo": True}),
        ("station_facility", "Lift menuju peron sedang tidak dapat digunakan.", "medium", "resolved", {"station": "Stasiun Halim", "demo": True}),
        ("train_service", "Area tempat duduk terasa kurang bersih saat perjalanan.", "low", "closed", {"station": "Stasiun Tegalluar", "demo": True}),
        ("boarding_issue", "Gate boarding berubah dan informasi baru terlihat menjelang keberangkatan.", "medium", "under_review", {"station": "Stasiun Halim", "demo": True}),
        ("other", "Ingin memberi masukan mengenai alur pelayanan di stasiun.", "low", "submitted_to_demo_system", {"demo": True}),
    ]
    for idx, (category, description, priority, status, meta) in enumerate(demos):
        created = utcnow() - timedelta(days=idx, hours=3)
        conn.execute(
            """INSERT INTO complaints
               (id, ticket_number, user_id, category, description, priority, status, metadata, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                str(uuid.uuid4()),
                f"WH-DEMO-{1001 + idx}",
                DEMO_USER_ID,
                category,
                description,
                priority,
                status,
                json.dumps(meta, ensure_ascii=False),
                created.isoformat(),
                created.isoformat(),
            ),
        )


def init_db() -> None:
    from app.database.migrations import apply_migrations

    with get_conn() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.executescript(SCHEMA)
        apply_migrations(conn)
    from app.core.security import ensure_admin_user

    ensure_admin_user()
    from app.services.rag.knowledge import index_bundled_knowledge

    index_bundled_knowledge()
    from app.services.rag import vector_store

    try:
        vector_store.ensure_ready()
        with get_conn() as conn:
            vector_store.sync_from_sqlite(conn)
    except Exception as exc:
        logger.warning("Sinkronisasi pgvector saat startup dilewati: %s", exc)
    with get_conn() as conn:
        _seed_conversations(conn)
        _seed_complaints(conn)


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)
