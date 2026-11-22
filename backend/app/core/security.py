"""Self-hosted accounts and sessions.

Passwords use PBKDF2-HMAC-SHA256 from the standard library; session tokens are
random, stored only as SHA-256 hashes, and sent to browsers as HttpOnly cookies.
No external identity provider is required.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import re
import secrets
import sqlite3
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from fastapi import Cookie, Depends, Header, HTTPException, Request, Response

from app.core.config import (
    ADMIN_BOOTSTRAP_PATH,
    ADMIN_EMAIL,
    ADMIN_NAME,
    ADMIN_PASSWORD,
    DEMO_USER_ID,
    GUEST_HEADER,
    SESSION_COOKIE_NAME,
    SESSION_COOKIE_SECURE,
    SESSION_TTL_DAYS,
)
from app.database.db import get_conn, now_iso, utcnow

logger = logging.getLogger("whoosh_ai.auth")

PBKDF2_ITERATIONS = 210_000
_GUEST_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass(frozen=True)
class AuthUser:
    id: str
    name: str
    email: str
    role: str
    created_at: str
    last_login_at: str | None


@dataclass(frozen=True)
class Actor:
    user: AuthUser | None
    actor_id: str
    guest_id: str | None

    @property
    def scope_ids(self) -> tuple[str, ...]:
        return (self.actor_id,)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def valid_email(email: str) -> bool:
    return bool(_EMAIL_RE.match(email)) and len(email) <= 160


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, iterations, salt, digest = encoded.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt),
            int(iterations),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(candidate.hex(), digest)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _row_to_user(row: sqlite3.Row) -> AuthUser:
    return AuthUser(
        id=row["id"],
        name=row["name"],
        email=row["email"],
        role=row["role"],
        created_at=row["created_at"],
        last_login_at=row["last_login_at"],
    )


def public_user(user: AuthUser) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
    }


def create_session(user_id: str) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    expires_at = (utcnow() + timedelta(days=SESSION_TTL_DAYS)).isoformat()
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_used_at)
               VALUES (?, ?, ?, ?, ?)""",
            (_token_hash(token), user_id, now_iso(), expires_at, now_iso()),
        )
        conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (now_iso(),))
    return token, expires_at


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=SESSION_COOKIE_SECURE,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")


def delete_session(token: str | None) -> None:
    if not token:
        return
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))


def resolve_session(token: str | None) -> AuthUser | None:
    if not token:
        return None
    token_hash = _token_hash(token)
    with get_conn() as conn:
        row = conn.execute(
            """SELECT u.*, s.expires_at FROM sessions s
               JOIN users u ON u.id = s.user_id
               WHERE s.token_hash = ?""",
            (token_hash,),
        ).fetchone()
        if not row:
            return None
        if row["expires_at"] <= now_iso():
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
            return None
        conn.execute("UPDATE sessions SET last_used_at = ? WHERE token_hash = ?", (now_iso(), token_hash))
    return _row_to_user(row)


def _extract_token(cookie_token: str | None, authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        if token:
            return token
    return cookie_token


def get_current_user(
    request: Request,
    whoosh_session: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    authorization: str | None = Header(default=None),
) -> AuthUser | None:
    return resolve_session(_extract_token(whoosh_session, authorization))


def require_user(user: AuthUser | None = Depends(get_current_user)) -> AuthUser:
    if not user:
        raise HTTPException(status_code=401, detail="Silakan masuk terlebih dahulu.")
    return user


def require_admin(user: AuthUser = Depends(require_user)) -> AuthUser:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Akun ini tidak memiliki akses admin.")
    return user


def get_actor(
    user: AuthUser | None = Depends(get_current_user),
    x_guest_id: str | None = Header(default=None, alias=GUEST_HEADER),
) -> Actor:
    guest = x_guest_id.strip() if x_guest_id and _GUEST_RE.match(x_guest_id.strip()) else None
    if user:
        return Actor(user=user, actor_id=user.id, guest_id=guest)
    return Actor(user=None, actor_id=guest or DEMO_USER_ID, guest_id=guest)


def claim_guest_data(guest_id: str | None, user_id: str) -> None:
    if not guest_id or guest_id == DEMO_USER_ID or guest_id == user_id:
        return
    with get_conn() as conn:
        conn.execute("UPDATE conversations SET user_id = ? WHERE user_id = ?", (user_id, guest_id))
        conn.execute("UPDATE complaints SET user_id = ? WHERE user_id = ?", (user_id, guest_id))


def _create_user(
    conn: sqlite3.Connection, name: str, email: str, password_hash: str, role: str
) -> str:
    user_id = str(secrets.token_hex(16))
    conn.execute(
        """INSERT INTO users (id, name, email, password_hash, role, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (user_id, name, email, password_hash, role, now_iso()),
    )
    return user_id


def ensure_admin_user() -> None:
    """Seed or update the local admin account without shipping a default password."""
    email = normalize_email(ADMIN_EMAIL)
    if not valid_email(email):
        logger.warning("ADMIN_EMAIL tidak valid; memakai admin@whoosh.local")
        email = "admin@whoosh.local"

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, email FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1"
        ).fetchone()

        if ADMIN_PASSWORD:
            password = ADMIN_PASSWORD
            if len(password) < 8:
                logger.warning("ADMIN_PASSWORD kurang dari 8 karakter; gunakan hanya untuk demo lokal.")
            if row:
                conn.execute(
                    "UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?",
                    (ADMIN_NAME, email, hash_password(password), row["id"]),
                )
            else:
                _create_user(conn, ADMIN_NAME, email, hash_password(password), "admin")
            return

        if row:
            return

        password = secrets.token_urlsafe(12)
        _create_user(conn, ADMIN_NAME, email, hash_password(password), "admin")
        ADMIN_BOOTSTRAP_PATH.parent.mkdir(parents=True, exist_ok=True)
        ADMIN_BOOTSTRAP_PATH.write_text(
            "Whoosh AI - kredensial admin lokal (dibuat sekali)\n"
            f"email: {email}\n"
            f"password: {password}\n\n"
            "Hapus file ini setelah disalin. Untuk mengganti kata sandi, set ADMIN_PASSWORD\n"
            "di environment backend lalu restart.\n",
            encoding="utf-8",
        )
        logger.warning(
            "Akun admin lokal dibuat. Kredensial awal tersimpan di %s", ADMIN_BOOTSTRAP_PATH
        )
