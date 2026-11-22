import json
import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import Actor, AuthUser, get_actor, require_admin
from app.database.db import get_conn, now_iso
from app.schemas import ComplaintAnalyzeRequest, ComplaintCreate, ComplaintUpdate

router = APIRouter(tags=["complaints"])

CATEGORY_KEYWORDS = {
    "lost_and_found": ["hilang", "tertinggal", "ketinggalan", "tas", "dompet", "koper", "barang", "lost", "found"],
    "ticket_issue": ["tiket", "ticket", "jadwal", "batal", "refund", "pemesanan", "nama", "identitas", "harga"],
    "boarding_issue": ["boarding", "board", "gate", "terlambat", "keberangkatan", "naik", "antre", "antrian"],
    "station_facility": ["lift", "toilet", "eskalator", "fasilitas", "stasiun", "musala", "ac", "akses", "parkir"],
    "train_service": ["kereta", "kursi", "kebersihan", "petugas", "pelayanan", "dingin", "panas", "gerbong", "ac"],
}

CATEGORY_LABELS = {
    "lost_and_found": "Barang tertinggal",
    "ticket_issue": "Masalah tiket",
    "boarding_issue": "Proses boarding",
    "station_facility": "Fasilitas stasiun",
    "train_service": "Layanan kereta",
    "other": "Lainnya",
}


def _serialize(row) -> dict:
    item = dict(row)
    metadata = json.loads(item.pop("metadata", None) or "{}")
    item["metadata"] = metadata
    for key in ("travel_date", "station", "train_info", "contact", "summary"):
        item[key] = metadata.get(key)
    item["demo"] = True
    item["category_label"] = CATEGORY_LABELS.get(item["category"], "Lainnya")
    return item


def _make_ticket_number() -> str:
    stamp = datetime.now().strftime("%y%m%d")
    return f"WH-{stamp}-{secrets.token_hex(3).upper()}"


@router.post("/complaints/analyze")
def analyze_complaint(payload: ComplaintAnalyzeRequest) -> dict:
    text = payload.description.lower()
    scores = {
        category: sum(1 for keyword in keywords if keyword in text)
        for category, keywords in CATEGORY_KEYWORDS.items()
    }
    category = max(scores, key=scores.get) if max(scores.values()) > 0 else "other"
    priority = "high" if any(word in text for word in ["hilang", "rusak", "terlambat", "gagal", "darurat"]) else "medium"

    missing: list[str] = []
    if not payload.station:
        missing.append("stasiun")
    if not payload.travel_date:
        missing.append("tanggal perjalanan")
    if not payload.train_info:
        missing.append("nomor kereta")
    missing.append("kontak yang dapat dihubungi")

    summary = (
        f"Kategori: {CATEGORY_LABELS[category]}. "
        f"Ringkasan: {payload.description.strip()[:280]}"
    )
    return {
        "category": category,
        "category_label": CATEGORY_LABELS[category],
        "priority": priority,
        "missing_fields": missing,
        "summary": summary,
        "demo": True,
        "notice": "Analisis ini adalah simulasi aturan sederhana, bukan model produksi.",
    }


@router.post("/complaints", status_code=201)
def create_complaint(payload: ComplaintCreate, actor: Actor = Depends(get_actor)) -> dict:
    metadata = {
        "travel_date": payload.travel_date.isoformat() if payload.travel_date else None,
        "station": payload.station,
        "train_info": payload.train_info,
        "contact": payload.contact,
        "summary": payload.summary,
        "demo": True,
        "notice": "Laporan simulasi internal prototype Whoosh AI, bukan tiket resmi operator.",
    }
    complaint_id = str(uuid.uuid4())
    timestamp = now_iso()
    with get_conn() as conn:
        ticket = _make_ticket_number()
        while conn.execute("SELECT 1 FROM complaints WHERE ticket_number = ?", (ticket,)).fetchone():
            ticket = _make_ticket_number()
        conn.execute(
            """INSERT INTO complaints
               (id, ticket_number, user_id, category, description, priority, status, metadata, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'submitted_to_demo_system', ?, ?, ?)""",
            (
                complaint_id,
                ticket,
                actor.actor_id,
                payload.category,
                payload.description.strip(),
                payload.priority,
                json.dumps(metadata, ensure_ascii=False),
                timestamp,
                timestamp,
            ),
        )
        row = conn.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,)).fetchone()
    return _serialize(row)


@router.get("/complaints")
def list_complaints(
    category: str | None = None,
    status: str | None = None,
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    actor: Actor = Depends(get_actor),
) -> dict:
    placeholders = ",".join("?" for _ in actor.scope_ids)
    where = [f"user_id IN ({placeholders})"]
    params: list = list(actor.scope_ids)
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
        total = conn.execute(f"SELECT COUNT(*) AS n FROM complaints WHERE {clause}", params).fetchone()["n"]
        rows = conn.execute(
            f"SELECT * FROM complaints WHERE {clause} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            [*params, limit, offset],
        ).fetchall()
    return {"items": [_serialize(row) for row in rows], "total": total, "demo": True}


@router.get("/complaints/ticket/{ticket_number}")
def get_complaint_by_ticket(ticket_number: str, actor: Actor = Depends(get_actor)) -> dict:
    placeholders = ",".join("?" for _ in actor.scope_ids)
    with get_conn() as conn:
        row = conn.execute(
            f"SELECT * FROM complaints WHERE ticket_number = ? AND user_id IN ({placeholders})",
            (ticket_number, *actor.scope_ids),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    return _serialize(row)


@router.get("/complaints/{complaint_id}")
def get_complaint(complaint_id: str, actor: Actor = Depends(get_actor)) -> dict:
    placeholders = ",".join("?" for _ in actor.scope_ids)
    with get_conn() as conn:
        row = conn.execute(
            f"SELECT * FROM complaints WHERE id = ? AND user_id IN ({placeholders})",
            (complaint_id, *actor.scope_ids),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    return _serialize(row)


@router.patch("/complaints/{complaint_id}")
def update_complaint(
    complaint_id: str, payload: ComplaintUpdate, admin: AuthUser = Depends(require_admin)
) -> dict:
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM complaints WHERE id = ?", (complaint_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
        conn.execute(
            "UPDATE complaints SET status = ?, updated_at = ? WHERE id = ?",
            (payload.status, now_iso(), complaint_id),
        )
        updated = conn.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,)).fetchone()
    return _serialize(updated)
