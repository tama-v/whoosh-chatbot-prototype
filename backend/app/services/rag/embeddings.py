"""Embedding helpers for hybrid retrieval.

Two backends are supported:
- hashed-token-v1: deterministic offline hashing-trick vectors (no key, no network).
- Qwen text embeddings (OpenAI-compatible /embeddings) when the backend key is set.
"""

import hashlib
import math
import re
from array import array

import httpx

from app.core.config import (
    DASHSCOPE_API_KEY,
    EMBEDDINGS_CONFIGURED,
    QWEN_BASE_URL,
    QWEN_EMBEDDING_MODEL,
)

HASHED_MODEL = "hashed-token-v1"
HASHED_DIMS = 512
QWEN_EMBED_DIMS = 1024

_TOKEN_RE = re.compile(r"[a-zA-Z0-9]+")
_STOPWORDS = {
    "yang", "dan", "di", "ke", "dari", "untuk", "dengan", "pada", "adalah", "ini", "itu",
    "saya", "aku", "kamu", "anda", "bisa", "dapat", "bagaimana", "apa", "apakah", "cara",
    "the", "and", "for", "with", "what", "how", "where", "when", "why", "who", "is", "are",
    "can", "could", "would", "should", "do", "does", "my", "your", "our", "about", "please",
    "there", "here", "this", "that", "these", "those", "was", "were", "been", "being", "have",
    "has", "had", "will", "shall", "may", "might", "must", "me", "we", "us", "they", "them",
    "he", "she", "it", "its", "his", "her", "their", "yours", "mine", "all", "any", "some",
    "each", "every", "more", "most", "other", "such", "only", "same", "than", "too", "very",
    "just", "now", "also", "into", "over", "under", "then", "once", "both", "few", "many",
    "much", "get", "got", "make", "made", "use", "used", "using", "one", "two",
}


def _terms(text: str) -> list[str]:
    tokens = [t.lower() for t in _TOKEN_RE.findall(text)]
    return [t for t in tokens if len(t) > 2 and t not in _STOPWORDS]


def _bucket(term: str) -> tuple[int, float]:
    digest = hashlib.blake2b(term.encode("utf-8"), digest_size=8).digest()
    value = int.from_bytes(digest, "big")
    sign = 1.0 if value & 1 else -1.0
    return (value >> 8) % HASHED_DIMS, sign


def hashed_embedding(text: str) -> list[float]:
    """Offline lexical vector: hashed unigrams, bigrams and character 4-grams."""
    vector = [0.0] * HASHED_DIMS
    tokens = _terms(text)
    for token in tokens:
        bucket, sign = _bucket(f"u:{token}")
        vector[bucket] += sign
        if len(token) >= 8:
            bucket, sign = _bucket(f"s:{token[:6]}")
            vector[bucket] += 0.5 * sign
    for left, right in zip(tokens, tokens[1:]):
        bucket, sign = _bucket(f"b:{left}_{right}")
        vector[bucket] += 0.7 * sign
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [round(value / norm, 5) for value in vector]


def pack_vector(vector: list[float]) -> bytes:
    return array("f", vector).tobytes()


def unpack_vector(blob: bytes) -> list[float]:
    values = array("f")
    values.frombytes(blob)
    return values.tolist()


def cosine(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if not left_norm or not right_norm:
        return 0.0
    return dot / (left_norm * right_norm)


_qwen_broken = False


def _trust_env() -> bool:
    # Local OpenAI-compatible servers (Ollama, LM Studio) must not go through ambient proxies.
    host = httpx.URL(QWEN_BASE_URL).host if QWEN_BASE_URL else ""
    if host in {"127.0.0.1", "localhost", "::1"}:
        return False
    try:
        httpx.Client(trust_env=True).close()
    except httpx.InvalidURL:
        return False
    return True


_TRUST_ENV = _trust_env()


def _qwen_embed(texts: list[str]) -> list[list[float]]:
    global _qwen_broken
    if _qwen_broken:
        raise RuntimeError("Qwen embeddings tidak tersedia pada proses ini")
    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
    }
    vectors: list[list[float]] = []
    with httpx.Client(
        timeout=httpx.Timeout(30.0, connect=10.0), trust_env=_TRUST_ENV
    ) as client:
        for start in range(0, len(texts), 10):
            batch = texts[start:start + 10]
            response = client.post(
                f"{QWEN_BASE_URL}/embeddings",
                headers=headers,
                json={
                    "model": QWEN_EMBEDDING_MODEL,
                    "input": batch,
                    "dimensions": QWEN_EMBED_DIMS,
                    "encoding_format": "float",
                },
            )
            response.raise_for_status()
            data = response.json().get("data") or []
            ordered = sorted(data, key=lambda item: item.get("index", 0))
            vectors.extend([item["embedding"] for item in ordered])
            if len(ordered) != len(batch):
                raise RuntimeError("Jumlah embedding tidak sesuai dengan input")
    return vectors


def embed_texts(texts: list[str]) -> tuple[list[list[float]], str]:
    """Embed chunks. Prefers Qwen when configured, always falls back to the offline model."""
    if not texts:
        return [], HASHED_MODEL
    if EMBEDDINGS_CONFIGURED:
        try:
            return _qwen_embed(texts), QWEN_EMBEDDING_MODEL
        except Exception:
            _qwen_broken = True
    return [hashed_embedding(text) for text in texts], HASHED_MODEL


def embed_query(text: str, preferred_model: str | None = None) -> tuple[list[float], str]:
    if preferred_model and preferred_model != HASHED_MODEL and EMBEDDINGS_CONFIGURED:
        try:
            return _qwen_embed([text])[0], preferred_model
        except Exception:
            _qwen_broken = True
    return hashed_embedding(text), HASHED_MODEL
