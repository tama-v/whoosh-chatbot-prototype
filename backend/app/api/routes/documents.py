import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.config import ALLOWED_DOC_TYPES, KNOWLEDGE_DIR, MAX_UPLOAD_BYTES, UPLOAD_DIR
from app.core.security import AuthUser, require_admin
from app.database.db import get_conn, now_iso
from app.services.rag.knowledge import index_text, list_documents, reindex_document

router = APIRouter(tags=["knowledge"])


def _serialize(row: dict) -> dict:
    item = dict(row)
    path = Path(item.get("file_path", ""))
    item["demo"] = KNOWLEDGE_DIR in path.parents or "whoosh-ai-demo" in item.get("file_path", "")
    item["size_label"] = item.get("file_type", "").upper()
    return item


@router.get("/documents")
def documents_list(admin: AuthUser = Depends(require_admin)) -> dict:
    return {"items": [_serialize(row) for row in list_documents()], "demo": True}


@router.post("/documents", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    admin: AuthUser = Depends(require_admin),
) -> dict:
    filename = Path(file.filename or "dokumen").name
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=415, detail="Format harus PDF, TXT, atau Markdown")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="File kosong")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Ukuran file melebihi 5 MB")

    doc_id = str(uuid.uuid4())
    safe_name = f"{doc_id}{suffix}"
    target = UPLOAD_DIR / safe_name
    target.write_bytes(data)

    from app.services.rag.knowledge import extract_text

    try:
        text = extract_text(data, suffix)
    except Exception as exc:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Gagal mengekstrak teks: {exc}") from exc
    if not text.strip():
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="Dokumen tidak memiliki teks yang dapat dibaca")

    try:
        index_text(
            doc_id,
            title or Path(filename).stem,
            text,
            str(target),
            suffix.lstrip("."),
            uploaded_by=admin.email,
        )
    except Exception as exc:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Gagal mengindeks dokumen: {exc}") from exc

    with get_conn() as conn:
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    return _serialize(dict(row))


@router.post("/documents/{document_id}/reindex")
def reindex(document_id: str, admin: AuthUser = Depends(require_admin)) -> dict:
    try:
        result = reindex_document(document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
    return {"document": _serialize(dict(row)), "chunks": result["chunk_count"]}


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(document_id: str, admin: AuthUser = Depends(require_admin)) -> None:
    from app.services.rag.knowledge import delete_document as remove_document

    if not remove_document(document_id):
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    with get_conn() as conn:
        conn.execute("UPDATE documents SET updated_at = ? WHERE id = ?", (now_iso(), document_id))
