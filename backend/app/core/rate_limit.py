"""In-process token-bucket rate limiting.

No Redis or external service: the demo is a single-process FastAPI app. Buckets
are keyed by client IP and route group, and reset automatically.
"""

from __future__ import annotations

import json
import math
import re
import threading
import time
from dataclasses import dataclass

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import (
    RATE_LIMIT_ADMIN,
    RATE_LIMIT_CHAT,
    RATE_LIMIT_DEFAULT,
    RATE_LIMIT_ENABLED,
    RATE_LIMIT_LOGIN,
    RATE_LIMIT_TRUST_PROXY,
    RATE_LIMIT_VOICE,
)

WINDOW_SECONDS = 60
RULES: list[tuple[str, re.Pattern[str], int]] = [
    ("auth", re.compile(r"^/api/v1/auth/(login|register)$"), RATE_LIMIT_LOGIN),
    ("chat", re.compile(r"^/api/v1/chat(/stream)?$"), RATE_LIMIT_CHAT),
    ("voice", re.compile(r"^/api/v1/voice/(transcribe|synthesize)$"), RATE_LIMIT_VOICE),
    ("admin", re.compile(r"^/api/v1/admin/"), RATE_LIMIT_ADMIN),
]
EXEMPT_PATHS = {"/api/v1/health", "/api/v1/voice/health"}


@dataclass
class Bucket:
    tokens: float
    updated: float


@dataclass
class Decision:
    allowed: bool
    limit: int
    remaining: int
    retry_after: int


class TokenBucketLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, Bucket] = {}
        self._lock = threading.Lock()

    def check(self, key: str, capacity: int) -> Decision:
        now = time.monotonic()
        refill_per_second = capacity / WINDOW_SECONDS
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = Bucket(tokens=float(capacity), updated=now)
                self._buckets[key] = bucket
            else:
                elapsed = max(0.0, now - bucket.updated)
                bucket.tokens = min(float(capacity), bucket.tokens + elapsed * refill_per_second)
                bucket.updated = now

            if bucket.tokens >= 1.0:
                bucket.tokens -= 1.0
                result = Decision(True, capacity, int(bucket.tokens), 0)
            else:
                wait = (1.0 - bucket.tokens) / refill_per_second
                result = Decision(False, capacity, 0, max(1, math.ceil(wait)))

            if len(self._buckets) > 5000:
                cutoff = now - 600
                stale = [name for name, item in self._buckets.items() if item.updated < cutoff]
                for name in stale:
                    self._buckets.pop(name, None)
        return result


def _rule_for(path: str) -> tuple[str, int]:
    for name, pattern, limit in RULES:
        if pattern.match(path):
            return name, limit
    return "default", RATE_LIMIT_DEFAULT


def _client_ip(scope: Scope) -> str:
    if RATE_LIMIT_TRUST_PROXY:
        for raw_name, raw_value in scope.get("headers", []):
            if raw_name.lower() == b"x-forwarded-for":
                return raw_value.decode("latin-1").split(",")[0].strip() or "unknown"
    client = scope.get("client")
    return client[0] if client else "unknown"


class RateLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.limiter = TokenBucketLimiter()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            not RATE_LIMIT_ENABLED
            or scope.get("type") != "http"
            or scope.get("method") == "OPTIONS"
        ):
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if not path.startswith("/api/v1") or path in EXEMPT_PATHS:
            await self.app(scope, receive, send)
            return

        group, limit = _rule_for(path)
        decision = self.limiter.check(f"{group}:{_client_ip(scope)}", limit)

        if not decision.allowed:
            body = json.dumps(
                {
                    "detail": (
                        f"Terlalu banyak permintaan. Coba lagi dalam {decision.retry_after} detik."
                    ),
                    "retry_after": decision.retry_after,
                },
                ensure_ascii=False,
            ).encode("utf-8")
            headers = [
                (b"content-type", b"application/json; charset=utf-8"),
                (b"content-length", str(len(body)).encode()),
                (b"retry-after", str(decision.retry_after).encode()),
                (b"x-ratelimit-limit", str(decision.limit).encode()),
                (b"x-ratelimit-remaining", b"0"),
                (b"x-ratelimit-reset", str(decision.retry_after).encode()),
            ]
            await send({"type": "http.response.start", "status": 429, "headers": headers})
            await send({"type": "http.response.body", "body": body, "more_body": False})
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.append("X-RateLimit-Limit", str(decision.limit))
                headers.append("X-RateLimit-Remaining", str(decision.remaining))
                headers.append("X-RateLimit-Reset", str(WINDOW_SECONDS))
            await send(message)

        await self.app(scope, receive, send_with_headers)
