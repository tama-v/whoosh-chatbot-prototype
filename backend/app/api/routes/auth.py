import logging
import sqlite3
import uuid

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response

from app.core.config import GUEST_HEADER, SESSION_COOKIE_NAME
from app.core.security import (
    AuthUser,
    claim_guest_data,
    clear_session_cookie,
    create_session,
    delete_session,
    hash_password,
    normalize_email,
    public_user,
    require_user,
    set_session_cookie,
    valid_email,
    verify_password,
)
from app.database.db import get_conn, now_iso
from app.schemas import LoginRequest, RegisterRequest

logger = logging.getLogger("whoosh_ai.auth")
router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_payload(user: AuthUser, token: str, expires_at: str) -> dict:
    return {
        "user": public_user(user),
        "access_token": token,
        "token_type": "bearer",
        "expires_at": expires_at,
        "notice": "Sesi tersimpan sebagai cookie HttpOnly. Token Bearer disediakan untuk aplikasi mobile.",
    }


def _fetch_user_by_email(email: str):
    with get_conn() as conn:
        return conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()


def _fetch_user_by_id(user_id: str):
    with get_conn() as conn:
        return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def _login_response(response: Response, user_id: str, guest_id: str | None) -> dict:
    token, expires_at = create_session(user_id)
    set_session_cookie(response, token)
    claim_guest_data(guest_id, user_id)
    row = _fetch_user_by_id(user_id)
    user = AuthUser(
        id=row["id"],
        name=row["name"],
        email=row["email"],
        role=row["role"],
        created_at=row["created_at"],
        last_login_at=row["last_login_at"],
    )
    return _auth_payload(user, token, expires_at)


@router.post("/register", status_code=201)
def register(
    payload: RegisterRequest,
    response: Response,
    x_guest_id: str | None = Header(default=None, alias=GUEST_HEADER),
) -> dict:
    email = normalize_email(payload.email)
    if not valid_email(email):
        raise HTTPException(status_code=422, detail="Format email tidak valid.")
    name = " ".join(payload.name.split())[:60]
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Nama minimal 2 karakter.")

    with get_conn() as conn:
        user_id = uuid.uuid4().hex
        try:
            conn.execute(
                """INSERT INTO users (id, name, email, password_hash, role, created_at, last_login_at)
                   VALUES (?, ?, ?, ?, 'passenger', ?, ?)""",
                (user_id, name, email, hash_password(payload.password), now_iso(), now_iso()),
            )
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=409, detail="Email sudah terdaftar.") from exc
    return _login_response(response, user_id, x_guest_id)


@router.post("/login")
def login(
    payload: LoginRequest,
    response: Response,
    x_guest_id: str | None = Header(default=None, alias=GUEST_HEADER),
) -> dict:
    email = normalize_email(payload.email)
    row = _fetch_user_by_email(email)
    if not row or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah.")
    with get_conn() as conn:
        conn.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now_iso(), row["id"]))
    return _login_response(response, row["id"], x_guest_id)


@router.get("/me")
def me(user: AuthUser = Depends(require_user)) -> dict:
    return {"user": public_user(user)}


@router.post("/logout")
def logout(
    response: Response,
    whoosh_session: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    authorization: str | None = Header(default=None),
) -> dict:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    token = token or whoosh_session
    delete_session(token)
    clear_session_cookie(response)
    return {"ok": True}
