import math
import re
import sqlite3
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.config import KNOWLEDGE_DIR
from app.database.db import get_conn, now_iso
from app.database.migrations import fts_available, rebuild_fts
from app.services.rag.embeddings import (
    HASHED_MODEL,
    cosine,
    embed_query,
    embed_texts,
    pack_vector,
    unpack_vector,
)

STOPWORDS = {
    "yang", "dan", "di", "ke", "dari", "untuk", "dengan", "pada", "adalah", "ini", "itu",
    "saya", "aku", "kamu", "anda", "bisa", "dapat", "bagaimana", "apa", "apakah", "cara",
    "gimana", "dimana", "mana", "kapan", "kenapa", "mengapa", "berapa", "siapa", "tolong",
    "mohon", "ingin", "mau", "akan", "sudah", "belum", "tidak", "bukan", "ada", "juga",
    "atau", "kalau", "jika", "saat", "ketika", "oleh", "sebagai", "dalam", "tentang", "the",
    "and", "for", "with", "what", "how", "where", "when", "why", "who", "is", "are", "am",
    "can", "could", "would", "should", "do", "does", "my", "your", "our", "about", "please",
    "tell", "give", "want", "need", "whoosh", "heiser",
    "there", "here", "this", "that", "these", "those", "was", "were", "been", "being", "have",
    "has", "had", "will", "shall", "may", "might", "must", "me", "we", "us", "they", "them",
    "he", "she", "it", "its", "his", "her", "their", "yours", "mine", "all", "any", "some",
    "each", "every", "more", "most", "other", "such", "only", "same", "than", "too", "very",
    "just", "now", "also", "into", "over", "under", "then", "once", "both", "few", "many",
    "much", "get", "got", "make", "made", "use", "used", "using", "one", "two",
    "saja", "prosedur", "adakah", "bisakah", "bolehkah", "berapakah", "bagaimanakah",
    "info", "informasi", "mengenai", "soal", "hal", "work", "works", "happen", "mean",
    "explain", "describe",
    "aja", "ajah", "lah", "pun", "deh", "sih", "tuh", "kan", "nih", "yah", "eh", "kok",
    "banyak", "semua", "semuanya", "banget",
    "hmm", "hm", "wkwk", "hehe", "haha", "oke", "ok", "sip", "siap", "mantap", "baik",
    "gak", "nggak", "ngga", "engga", "ga",
}

SYNONYMS = {
    "board": {"boarding", "naik", "keberangkatan"},
    "boarding": {"board", "naik", "keberangkatan"},
    "bagasi": {"koper", "tas", "luggage", "baggage"},
    "koper": {"bagasi", "tas"},
    "baggage": {"bagasi", "luggage", "bag"},
    "luggage": {"bagasi", "baggage", "bag"},
    "tertinggal": {"hilang", "lost", "ketinggalan"},
    "hilang": {"tertinggal", "lost"},
    "jadwal": {"schedule", "reschedule", "ubah", "perubahan"},
    "ubah": {"jadwal", "reschedule", "perubahan"},
    "batal": {"pembatalan", "refund", "cancel"},
    "pembatalan": {"batal", "refund", "cancel"},
    "reschedule": {"schedule", "change", "jadwal"},
    "change": {"schedule", "ubah", "perubahan"},
    "cancel": {"cancellation", "refund", "batal", "pembatalan"},
    "cancellation": {"cancel", "refund", "pembatalan"},
    "tiket": {"ticket", "pemesanan"},
    "stasiun": {"station"},
    "fasilitas": {"facility", "toilet", "musala", "lift", "aksesibilitas"},
    "keluhan": {"complaint", "laporan", "masalah"},
    "laporan": {"keluhan", "complaint"},
    "refund": {"pembatalan", "refund"},
    "ticket": {"tiket", "pemesanan"},
    "station": {"stasiun"},
    "facility": {"facilities", "toilet", "lift", "elevator", "accessibility", "prayer", "musala"},
    "facilities": {"facility", "toilet", "lift", "elevator", "accessibility"},
    "lift": {"elevator", "accessibility", "facility", "fasilitas"},
    "elevator": {"lift", "accessibility", "facility"},
    "accessibility": {"accessible", "lift", "facility", "aksesibilitas"},
}

TOKEN_RE = re.compile(r"[a-zA-Z0-9]+")
RRF_K = 20

SOCIAL_VOCAB = {
    "halo", "hai", "hi", "hello", "hey", "selamat", "pagi", "siang", "sore", "malam",
    "apa", "kabar", "kabarmu", "kamu", "anda", "saya", "aku", "bisa", "bisakah", "dapat",
    "boleh", "kah", "bantu", "membantu", "bantulah", "tolong", "mohon", "dong", "ya",
    "kak", "min", "admin", "heiser", "siapa", "nama", "ini", "itu", "lakukan",
    "dilakukan", "kerjakan", "dikerjakan", "saja", "ada", "terima", "kasih", "makasih",
    "thanks", "thank", "you", "oke", "ok", "sampai", "jumpa", "tinggal", "bye",
    "mksh", "thx", "tq", "trims", "syukron", "terimakasih",
    "dadah", "tanya", "bertanya", "nanya", "mau", "ingin", "the", "can", "could",
    "would", "please", "help", "what", "who", "are", "is", "do", "does", "i", "my",
    "me", "your", "for", "of", "to", "it", "this", "that", "name", "goodbye",
    "test", "tes", "testing", "coba", "try", "ping", "p", "fitur", "fungsi",
}

SOCIAL_ANSWERS: dict[str, dict[str, str]] = {
    "greeting": {
        "id": (
            "Halo! Saya Heiser, asisten perjalanan Whoosh AI. Saya bisa membantu soal "
            "persiapan boarding, ketentuan bagasi, tiket dan perubahan jadwal, fasilitas "
            "stasiun, barang tertinggal, dan laporan keluhan.\n\nMau mulai dari topik apa?"
        ),
        "en": (
            "Hi! I am Heiser, the Whoosh AI travel assistant. I can help with boarding "
            "preparation, baggage rules, tickets and schedule changes, station facilities, "
            "lost items, and complaint reports.\n\nWhich topic would you like to start with?"
        ),
    },
    "capability": {
        "id": (
            "Tentu, saya siap membantu. Saya bisa menjelaskan persiapan boarding, ketentuan "
            "bagasi, tiket dan perubahan jadwal, fasilitas stasiun, penanganan barang "
            "tertinggal, serta membantu menyusun laporan keluhan. Semua jawaban diambil dari "
            "knowledge base lokal yang tersedia, bukan dari sistem operator.\n\n"
            "Sebutkan topiknya, misalnya \u201cpersiapan boarding\u201d atau \u201cketentuan bagasi\u201d."
        ),
        "en": (
            "Of course, happy to help. I can explain boarding preparation, baggage rules, "
            "tickets and schedule changes, station facilities, lost item handling, and help "
            "you draft a complaint report. All answers come from the local knowledge base, "
            "not from operator systems.\n\n"
            "Just name a topic, for example \u201cboarding preparation\u201d or \u201cbaggage rules\u201d."
        ),
    },
    "identity": {
        "id": (
            "Saya Heiser, asisten perjalanan Whoosh AI. Saya menjawab pertanyaan seputar "
            "perjalanan berdasarkan knowledge base lokal yang tersedia. Prototype ini tidak "
            "terhubung ke sistem operator."
        ),
        "en": (
            "I am Heiser, the Whoosh AI travel assistant. I answer travel questions from the "
            "local knowledge base. This prototype is not connected to operator systems."
        ),
    },
    "thanks": {
        "id": "Sama-sama! Kalau ada pertanyaan lain soal perjalanan, silakan tanya kapan saja.",
        "en": "You are welcome! If anything else comes up about your trip, just ask.",
    },
    "goodbye": {
        "id": "Sama-sama. Terima kasih sudah mampir, dan hati-hati di perjalanan.",
        "en": "You are welcome. Thanks for stopping by, and have a safe trip.",
    },
}


def detect_social_intent(text: str, language: str = "id") -> str | None:
    """Return a social intent when the message contains no domain topic at all."""
    tokens = TOKEN_RE.findall(text.lower())
    if not tokens or len(tokens) > 10:
        return None
    # Allow ordinary function words ("yang", "untuk", "cara") so a question like
    # "apa yang bisa anda lakukan untuk saya" is not treated as a topic query.
    if any(token not in SOCIAL_VOCAB and token not in STOPWORDS for token in tokens):
        return None
    if {
        "kasih", "makasih", "terimakasih", "mksh", "thx", "tq", "trims", "syukron",
        "thanks", "thank",
    } & set(tokens):
        return "thanks"
    if "siapa" in tokens or "who" in tokens:
        return "identity"
    if {"heiser", "name"} & set(tokens) and {"apa", "what", "itu", "this"} & set(tokens):
        return "identity"
    if {"jumpa", "tinggal", "bye", "dadah", "goodbye"} & set(tokens):
        return "goodbye"
    if {
        "bantu", "membantu", "bantulah", "help", "bisa", "bisakah", "dapat", "boleh",
        "tanya", "bertanya", "nanya", "lakukan", "dilakukan", "kerjakan", "fitur", "fungsi",
    } & set(tokens):
        return "capability"
    return "greeting"


def build_social_answer(intent: str, language: str = "id") -> str:
    answers = SOCIAL_ANSWERS.get(intent, SOCIAL_ANSWERS["greeting"])
    return answers.get("en" if language == "en" else "id", answers["id"])

EN_STOP_HINTS = {"the", "and", "is", "are", "how", "what", "can", "with", "for", "you", "my", "do"}
ID_STOP_HINTS = {"yang", "dan", "apa", "bagaimana", "cara", "bisa", "tidak", "untuk", "dengan", "saya"}


@dataclass
class SearchHit:
    document_id: str
    document_title: str
    section: str | None
    page_number: int | None
    content: str
    score: float
    document_language: str = "id"
    sources: list[str] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def citation(self) -> dict[str, Any]:
        return {
            "document_id": self.document_id,
            "document_title": self.document_title,
            "section": self.section,
            "page_number": self.page_number,
        }


def _singular(token: str) -> str:
    if len(token) > 3 and token.endswith("s") and not token.endswith(("ss", "us", "is")):
        return token[:-1]
    return token


def raw_tokens(text: str) -> set[str]:
    return {
        _singular(token.lower())
        for token in TOKEN_RE.findall(text)
        if len(token) > 2 and token.lower() not in STOPWORDS
    }


def tokenize(text: str) -> set[str]:
    raw = [t.lower() for t in TOKEN_RE.findall(text)]
    base = {t for t in raw if len(t) > 2 and t not in STOPWORDS}
    expanded = set(base)
    for term in base:
        expanded |= SYNONYMS.get(term, set())
    return expanded


def detect_language(text: str, filename: str = "") -> str:
    lowered = filename.lower()
    if lowered.endswith("-en.md") or lowered.endswith("-en.txt"):
        return "en"
    words = [token.lower() for token in TOKEN_RE.findall(text)]
    if not words:
        return "id"
    en = sum(1 for word in words if word in EN_STOP_HINTS)
    idn = sum(1 for word in words if word in ID_STOP_HINTS)
    if en and en >= idn:
        return "en"
    return "id"


def _strip_notice(text: str) -> str:
    lines = [line for line in text.splitlines() if not line.strip().startswith(">")]
    return "\n".join(lines).strip()


def split_sections(text: str) -> tuple[str, list[tuple[str, str]]]:
    text = _strip_notice(text)
    lines = text.splitlines()
    title = ""
    sections: list[tuple[str, list[str]]] = []
    current_name = "Ringkasan"
    current_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("# ") and not title:
            title = stripped[2:].strip()
            continue
        if stripped.startswith("## "):
            if current_lines:
                sections.append((current_name, current_lines))
            current_name = stripped[3:].strip()
            current_lines = []
            continue
        if stripped:
            current_lines.append(stripped)
    if current_lines:
        sections.append((current_name, current_lines))

    normalized: list[tuple[str, str]] = []
    for name, section_lines in sections:
        paragraph = "\n".join(section_lines).strip()
        if paragraph:
            normalized.append((name, paragraph))
    return title, normalized


def chunk_section(section: str, content: str, max_chars: int = 720) -> list[str]:
    if len(content) <= max_chars:
        return [content]
    parts: list[str] = []
    current = ""
    for block in content.split("\n"):
        candidate = f"{current}\n{block}".strip() if current else block
        if len(candidate) > max_chars and current:
            parts.append(current)
            current = block
        else:
            current = candidate
    if current:
        parts.append(current)
    return parts


def _insert_document(
    conn: sqlite3.Connection,
    doc_id: str,
    title: str,
    file_path: str,
    file_type: str,
    uploaded_by: str,
    language: str,
) -> None:
    timestamp = now_iso()
    conn.execute(
        """INSERT INTO documents (id, title, file_path, file_type, status, uploaded_by, chunk_count, language, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'processing', ?, 0, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET title=excluded.title, file_path=excluded.file_path,
             file_type=excluded.file_type, status='processing', language=excluded.language,
             error_message=NULL, updated_at=excluded.updated_at""",
        (doc_id, title, file_path, file_type, uploaded_by, language, timestamp, timestamp),
    )


def index_text(
    doc_id: str,
    title: str,
    text: str,
    file_path: str,
    file_type: str,
    uploaded_by: str = "system",
    language: str | None = None,
) -> dict[str, Any]:
    parsed_title, sections = split_sections(text)
    final_title = parsed_title or title
    final_language = language or detect_language(text, file_path)
    chunks: list[tuple[str, str, str]] = []
    for section_name, content in sections:
        for chunk in chunk_section(section_name, content):
            chunks.append((str(uuid.uuid4()), section_name, chunk))

    vectors, embedding_model = embed_texts([chunk[2] for chunk in chunks])

    with get_conn() as conn:
        _insert_document(conn, doc_id, final_title, file_path, file_type, uploaded_by, final_language)
        conn.execute("DELETE FROM document_chunks WHERE document_id = ?", (doc_id,))
        for chunk_id, section_name, content in chunks:
            conn.execute(
                """INSERT INTO document_chunks (id, document_id, content, page_number, section, metadata, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    chunk_id,
                    doc_id,
                    content,
                    None,
                    section_name,
                    f'{{"demo": true, "source": "whoosh-ai-demo", "language": "{final_language}"}}',
                    now_iso(),
                ),
            )
        for (chunk_id, _, _), vector in zip(chunks, vectors):
            conn.execute(
                """INSERT INTO chunk_embeddings (chunk_id, model, dims, vector, updated_at)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(chunk_id) DO UPDATE SET model=excluded.model, dims=excluded.dims,
                     vector=excluded.vector, updated_at=excluded.updated_at""",
                (chunk_id, embedding_model, len(vector), pack_vector(vector), now_iso()),
            )
        conn.execute(
            "UPDATE documents SET status='processed', chunk_count=?, updated_at=?, error_message=NULL WHERE id=?",
            (len(chunks), now_iso(), doc_id),
        )
        rebuild_fts(conn, doc_id)
    return {
        "id": doc_id,
        "title": final_title,
        "chunk_count": len(chunks),
        "language": final_language,
        "embedding_model": embedding_model,
    }


def _bundled_doc_id(path: Path) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"whoosh-ai-demo://{path.name}"))


def _needs_index(row: sqlite3.Row | None, path: Path) -> bool:
    if not row or row["chunk_count"] == 0 or row["status"] != "processed":
        return True
    try:
        return path.stat().st_mtime > datetime.fromisoformat(row["updated_at"]).timestamp() + 1
    except (ValueError, OSError):
        return False


def index_bundled_knowledge() -> None:
    for path in sorted(KNOWLEDGE_DIR.glob("*.md")):
        doc_id = _bundled_doc_id(path)
        with get_conn() as conn:
            row = conn.execute(
                "SELECT id, chunk_count, status, updated_at FROM documents WHERE id = ?", (doc_id,)
            ).fetchone()
        if not _needs_index(row, path):
            continue
        text = path.read_text(encoding="utf-8")
        index_text(
            doc_id,
            path.stem,
            text,
            str(path),
            path.suffix.lstrip("."),
            "system",
            language=detect_language(text, path.name),
        )


def reindex_document(doc_id: str) -> dict[str, Any]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    if not row:
        raise FileNotFoundError("Dokumen tidak ditemukan")
    path = Path(row["file_path"])
    if not path.exists():
        raise FileNotFoundError("File sumber tidak tersedia")
    if path.suffix.lower() == ".pdf":
        text = extract_text(path.read_bytes(), ".pdf")
    else:
        text = path.read_text(encoding="utf-8")
    return index_text(
        doc_id,
        row["title"],
        text,
        str(path),
        row["file_type"],
        row["uploaded_by"],
        language=row["language"] or detect_language(text, path.name),
    )


def extract_text(data: bytes, extension: str) -> str:
    if extension == ".pdf":
        from io import BytesIO

        from pypdf import PdfReader

        reader = PdfReader(BytesIO(data))
        return "\n".join((page.extract_text() or "") for page in reader.pages).strip()
    return data.decode("utf-8", errors="replace").strip()


def list_documents() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM documents ORDER BY created_at DESC").fetchall()
    return [dict(row) for row in rows]


def delete_document(doc_id: str) -> bool:
    with get_conn() as conn:
        row = conn.execute("SELECT id, file_path FROM documents WHERE id = ?", (doc_id,)).fetchone()
        if not row:
            return False
        if fts_available(conn):
            conn.execute("DELETE FROM chunk_fts WHERE document_id = ?", (doc_id,))
        conn.execute(
            "DELETE FROM chunk_embeddings WHERE chunk_id IN (SELECT id FROM document_chunks WHERE document_id = ?)",
            (doc_id,),
        )
        conn.execute("DELETE FROM document_chunks WHERE document_id = ?", (doc_id,))
        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    path = Path(row["file_path"])
    if path.exists() and "whoosh-ai-demo://" not in str(path) and KNOWLEDGE_DIR not in path.parents:
        try:
            path.unlink()
        except OSError:
            pass
    return True


def _fts_query(tokens: list[str]) -> str:
    safe = [token for token in tokens if token.isalnum()]
    return " OR ".join(f'"{token}"' for token in safe[:12])


def _lexical_ranks(
    rows: list[sqlite3.Row], query_terms: set[str]
) -> tuple[dict[str, float], dict[str, set[str]]]:
    if not query_terms:
        return {}, {}
    docs_tokens: list[tuple[sqlite3.Row, set[str]]] = []
    df: dict[str, int] = {}
    for row in rows:
        combined = f"{row['title']} {row['section'] or ''} {row['content']}"
        tokens = tokenize(combined)
        docs_tokens.append((row, tokens))
        for term in query_terms & tokens:
            df[term] = df.get(term, 0) + 1
    total = len(docs_tokens)
    ranked: dict[str, float] = {}
    tokens_by_id: dict[str, set[str]] = {}
    for row, tokens in docs_tokens:
        tokens_by_id[row["id"]] = tokens
        matched = query_terms & tokens
        if not matched:
            continue
        score = 0.0
        for term in matched:
            idf = 1.0 + math.log((total + 1) / (df.get(term, 1) + 0.5))
            score += idf
            if term in tokenize(row["section"] or ""):
                score += 0.4
        coverage = len(matched) / max(1, len(query_terms))
        score = (score / math.sqrt(len(query_terms))) * (0.55 + 0.45 * coverage)
        ranked[row["id"]] = round(score, 4)
    return ranked, tokens_by_id


def _vector_ranks(
    conn: sqlite3.Connection,
    query: str,
) -> tuple[dict[str, float], dict[str, Any]]:
    model_rows = conn.execute(
        "SELECT model, COUNT(*) AS n FROM chunk_embeddings GROUP BY model ORDER BY n DESC"
    ).fetchall()
    stored_models = {row["model"]: row["n"] for row in model_rows}
    if not stored_models:
        return {}, {"model": None, "backend": "none", "stored_models": {}}
    preferred = next(
        (model for model in stored_models if model != HASHED_MODEL),
        HASHED_MODEL,
    )
    vector, used_model = embed_query(query, preferred)
    rows = conn.execute(
        "SELECT chunk_id, model, vector FROM chunk_embeddings WHERE model = ?", (used_model,)
    ).fetchall()
    ranked: dict[str, float] = {}
    for row in rows:
        similarity = cosine(vector, unpack_vector(row["vector"]))
        if similarity > 0.05:
            ranked[row["chunk_id"]] = round(similarity, 4)
    trace = {
        "model": used_model,
        "backend": "hashed" if used_model == HASHED_MODEL else "qwen",
        "stored_models": stored_models,
    }
    return ranked, trace


def _rank_order(scores: dict[str, float]) -> dict[str, int]:
    ordered = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:40]
    return {chunk_id: index + 1 for index, (chunk_id, _) in enumerate(ordered)}


def retrieve_with_trace(
    query: str,
    top_k: int = 4,
    language: str | None = None,
) -> tuple[list[SearchHit], dict[str, Any]]:
    raw_terms = [token.lower() for token in TOKEN_RE.findall(query)]
    base_tokens = [token for token in raw_terms if len(token) > 2 and token not in STOPWORDS]
    query_raw = raw_tokens(query)
    query_terms = tokenize(query)
    trace: dict[str, Any] = {
        "strategy": "hybrid-rrf",
        "language": language,
        "tokens": base_tokens[:12],
        "candidates": {"fts": 0, "lexical": 0, "vector": 0, "chunks": 0},
        "embedding": {},
        "fts": False,
        "answerable": False,
        "best_coverage": 0.0,
        "hits": [],
    }
    if not query_terms:
        return [], trace

    with get_conn() as conn:
        fts_ok = fts_available(conn)
        trace["fts"] = fts_ok
        rows = conn.execute(
            """SELECT c.id, c.document_id, c.content, c.section, c.page_number,
                      d.title, COALESCE(d.language, 'id') AS language
               FROM document_chunks c JOIN documents d ON d.id = c.document_id
               WHERE d.status = 'processed'"""
        ).fetchall()
        trace["candidates"]["chunks"] = len(rows)
        if not rows:
            return [], trace

        raw_by_id = {
            row["id"]: raw_tokens(f"{row['title']} {row['section'] or ''} {row['content']}")
            for row in rows
        }
        corpus_raw = set().union(*raw_by_id.values())
        uncovered = {
            term
            for term in query_raw
            if not ({term} | {_singular(syn) for syn in SYNONYMS.get(term, set())}) & corpus_raw
        }
        trace["uncovered"] = sorted(uncovered)

        fts_ranks: dict[str, int] = {}
        if fts_ok:
            match = _fts_query(base_tokens)
            if match:
                try:
                    fts_rows = conn.execute(
                        """SELECT chunk_id, bm25(chunk_fts, 0.0, 0.0, 2.0, 1.5, 1.0) AS rank
                           FROM chunk_fts WHERE chunk_fts MATCH ?
                           ORDER BY rank LIMIT 40""",
                        (match,),
                    ).fetchall()
                    fts_ranks = {row["chunk_id"]: index + 1 for index, row in enumerate(fts_rows)}
                except sqlite3.OperationalError:
                    fts_ranks = {}

        lexical_scores, tokens_by_id = _lexical_ranks(rows, query_terms)
        lexical_ranks = _rank_order(lexical_scores)
        vector_scores, embedding_trace = _vector_ranks(conn, query)
        vector_ranks = _rank_order(vector_scores)
        trace["embedding"] = embedding_trace
        trace["candidates"].update(
            fts=len(fts_ranks), lexical=len(lexical_ranks), vector=len(vector_ranks)
        )

    row_by_id = {row["id"]: row for row in rows}
    fused: dict[str, dict[str, Any]] = {}
    sources_by_id: dict[str, list[str]] = {}
    for source, ranks, weight in (
        ("fts", fts_ranks, 1.0),
        ("lexical", lexical_ranks, 0.9),
        ("vector", vector_ranks, 1.0),
    ):
        for chunk_id, rank in ranks.items():
            entry = fused.setdefault(chunk_id, {"score": 0.0})
            entry["score"] += weight / (RRF_K + rank)
            sources_by_id.setdefault(chunk_id, []).append(source)

    language_bonus = 0.02
    selected_pool: list[tuple[str, float]] = []
    raw_coverage_by_id: dict[str, float] = {}
    for chunk_id, entry in fused.items():
        row = row_by_id.get(chunk_id)
        if not row:
            continue
        chunk_terms = tokens_by_id.get(chunk_id, set())
        coverage = len(query_terms & chunk_terms) / max(1, len(query_terms))
        chunk_raw = raw_by_id.get(chunk_id, set())
        raw_coverage = len(query_raw & chunk_raw) / max(1, len(query_raw))
        raw_coverage_by_id[chunk_id] = raw_coverage
        score = entry["score"] * (0.45 + 0.35 * coverage + 0.2 * raw_coverage)
        if query_terms & tokenize(row["title"]):
            score += 0.015
        if query_terms & tokenize(row["section"] or ""):
            score += 0.008
        if language and row["language"] == language:
            score += language_bonus
        selected_pool.append((chunk_id, score))

    best_coverage = max(raw_coverage_by_id.values(), default=0.0)
    trace["best_coverage"] = round(best_coverage, 3)
    if best_coverage < 0.5:
        return [], trace
    trace["answerable"] = True
    if language:
        same_language_pool = [
            (chunk_id, score)
            for chunk_id, score in selected_pool
            if row_by_id[chunk_id]["language"] == language and score >= 0.015
        ]
        if same_language_pool:
            selected_pool = same_language_pool
    selected_pool.sort(key=lambda item: item[1], reverse=True)

    hits: list[SearchHit] = []
    per_document: dict[str, int] = {}
    for chunk_id, score in selected_pool:
        if score < 0.01:
            continue
        if raw_coverage_by_id.get(chunk_id, 0.0) <= 0:
            continue
        row = row_by_id[chunk_id]
        per_document[row["document_id"]] = per_document.get(row["document_id"], 0) + 1
        if per_document[row["document_id"]] > 2:
            continue
        hit = SearchHit(
            document_id=row["document_id"],
            document_title=row["title"],
            section=row["section"],
            page_number=row["page_number"],
            content=row["content"],
            score=round(score, 4),
            document_language=row["language"],
            sources=sources_by_id.get(chunk_id, []),
            raw={
                "fts_rank": fts_ranks.get(chunk_id),
                "lexical_rank": lexical_ranks.get(chunk_id),
                "lexical_score": lexical_scores.get(chunk_id),
                "vector_rank": vector_ranks.get(chunk_id),
                "vector_score": vector_scores.get(chunk_id),
                "raw_coverage": round(raw_coverage_by_id.get(chunk_id, 0.0), 3),
            },
        )
        hits.append(hit)
        if len(hits) >= top_k:
            break

    trace["hits"] = [
        {
            "document_id": hit.document_id,
            "document_title": hit.document_title,
            "section": hit.section,
            "language": hit.document_language,
            "score": hit.score,
            "sources": hit.sources,
            "raw": hit.raw,
        }
        for hit in hits
    ]
    return hits, trace


def retrieve(query: str, top_k: int = 4, language: str | None = None) -> list[SearchHit]:
    hits, _trace = retrieve_with_trace(query, top_k=top_k, language=language)
    return hits


def _clean_chunk_text(text: str) -> str:
    lines: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if line.startswith(">"):
            line = line.lstrip(">").strip()
        if line in {"---", "***"}:
            continue
        lines.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


NUMERIC_ASK_RE = re.compile(
    r"\b(berapa|ukuran|dimensi|maksimal|maksimum|batas|kapasitas|kg|kilogram|liter|cm)\b",
    re.IGNORECASE,
)
GUIDANCE_RE = re.compile(
    r"(kanal resmi|situs resmi|layanan pelanggan|petugas|official channel|official website|"
    r"customer service|staff)",
    re.IGNORECASE,
)
STRONG_GUIDANCE_RE = re.compile(
    r"(kanal resmi|situs resmi|official channel|official website)", re.IGNORECASE
)


def select_demo_hits(
    question: str, hits: list[SearchHit], language: str = "id"
) -> tuple[list[SearchHit], str | None]:
    """Pick the chunks a template answer should quote, plus an optional caveat."""
    if not hits:
        return [], None

    query_raw = raw_tokens(question)
    doc_scores: dict[str, float] = {}
    for hit in hits:
        doc_scores[hit.document_id] = doc_scores.get(hit.document_id, 0.0) + hit.score
    top_document = max(doc_scores, key=doc_scores.get)
    doc_hits = [hit for hit in hits if hit.document_id == top_document]

    def content_coverage(hit: SearchHit) -> float:
        text = f"{hit.section or ''} {hit.content}"
        return len(query_raw & raw_tokens(text)) / max(1, len(query_raw))

    ranked = sorted(
        doc_hits,
        key=lambda hit: (
            content_coverage(hit),
            float(hit.raw.get("raw_coverage", 0.0)) if hit.raw else 0.0,
            hit.score,
        ),
        reverse=True,
    )
    best_coverage = content_coverage(ranked[0])
    focused = [hit for hit in ranked if content_coverage(hit) >= best_coverage - 0.001][:2]
    caveat: str | None = None

    if NUMERIC_ASK_RE.search(question) and not re.search(
        r"\d", " ".join(hit.content for hit in focused)
    ):
        guidance = next((hit for hit in doc_hits if STRONG_GUIDANCE_RE.search(hit.content)), None)
        if guidance is None:
            guidance = next((hit for hit in doc_hits if GUIDANCE_RE.search(hit.content)), None)
        if guidance:
            focused = [guidance]
            caveat = (
                "The demo knowledge base does not include specific figures for this question. "
                "Here is the general guidance available:"
                if language == "en"
                else "Knowledge base demo belum memuat angka spesifik untuk pertanyaan ini. "
                "Berikut ketentuan umum yang tersedia:"
            )
    return focused, caveat


def build_demo_answer(question: str, hits: list[SearchHit], language: str = "id") -> str:
    if not hits:
        if language == "en":
            return (
                "I could not find that in the demo knowledge base.\n\n"
                "I can help with boarding preparation, baggage rules, tickets and schedule "
                "changes, station facilities, lost items, and complaint reports. Just name a "
                "topic.\n\nFor important details, verify through the official operator "
                "channel — this prototype is not connected to operator systems."
            )
        return (
            "Saya belum menemukan info itu di knowledge base demo.\n\n"
            "Saya bisa bantu soal persiapan boarding, ketentuan bagasi, tiket dan perubahan "
            "jadwal, fasilitas stasiun, barang tertinggal, dan laporan keluhan. Sebutkan "
            "topiknya, ya.\n\nUntuk info penting, verifikasi ke kanal resmi operator — "
            "prototype ini tidak terhubung ke sistem operator."
        )

    focused, caveat = select_demo_hits(question, hits, language)
    blocks: list[str] = []
    for hit in focused:
        content = _clean_chunk_text(hit.content)
        if len(content) > 700:
            content = content[:700].rsplit(".", 1)[0] + "."
        blocks.append(content)
    body = "\n\n".join(blocks)
    if caveat:
        intro = caveat
    elif language == "en":
        intro = "Here is the relevant summary from the knowledge base:"
    else:
        intro = "Ini ringkasan yang relevan dari knowledge base:"
    return f"{intro}\n\n{body}"


def refresh_embeddings() -> dict[str, Any]:
    """Re-embed every chunk with the best configured backend."""
    with get_conn() as conn:
        rows = conn.execute("SELECT id, content FROM document_chunks").fetchall()
    if not rows:
        return {"chunks": 0, "model": None}
    vectors, model = embed_texts([row["content"] for row in rows])
    with get_conn() as conn:
        now = now_iso()
        for row, vector in zip(rows, vectors):
            conn.execute(
                """INSERT INTO chunk_embeddings (chunk_id, model, dims, vector, updated_at)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(chunk_id) DO UPDATE SET model=excluded.model, dims=excluded.dims,
                     vector=excluded.vector, updated_at=excluded.updated_at""",
                (row["id"], model, len(vector), pack_vector(vector), now),
            )
    return {"chunks": len(rows), "model": model, "dims": len(vectors[0]) if vectors else 0}


def retrieval_stats() -> dict[str, Any]:
    with get_conn() as conn:
        chunks = conn.execute("SELECT COUNT(*) AS n FROM document_chunks").fetchone()["n"]
        embedded = conn.execute("SELECT COUNT(*) AS n FROM chunk_embeddings").fetchone()["n"]
        fts_rows = 0
        if fts_available(conn):
            fts_rows = conn.execute("SELECT COUNT(*) AS n FROM chunk_fts").fetchone()["n"]
        models = {
            row["model"]: row["n"]
            for row in conn.execute(
                "SELECT model, COUNT(*) AS n FROM chunk_embeddings GROUP BY model"
            ).fetchall()
        }
        languages = {
            row["language"]: row["n"]
            for row in conn.execute(
                "SELECT COALESCE(language, 'id') AS language, COUNT(*) AS n FROM documents GROUP BY language"
            ).fetchall()
        }
    return {
        "chunks": chunks,
        "embedded": embedded,
        "fts_rows": fts_rows,
        "fts_available": fts_rows > 0,
        "embedding_models": models,
        "documents_by_language": languages,
        "strategy": "hybrid-rrf (FTS5 BM25 + lexical + vector)",
    }
