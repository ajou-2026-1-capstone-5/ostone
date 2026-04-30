from __future__ import annotations

# pyright: reportMissingTypeStubs=false
import os
import time
from collections.abc import Mapping, Sequence
from typing import TypeGuard

import httpx
import numpy as np

from pipeline.common.exceptions import PipelineConfigurationError
from pipeline.stages.intent_discovery.types import DEFAULT_EMBEDDING_BATCH_SIZE

DEFAULT_EMBEDDING_DIM = 768
DEFAULT_MODEL_NAME = "jina-embeddings-v5-text-small-mlx"
DEFAULT_OMLX_BASE_URL = "http://localhost:8081/v1"


def embed_texts(
    texts: Sequence[str],
    batch_size: int = DEFAULT_EMBEDDING_BATCH_SIZE,
    retry_max: int = 3,
    base_delay: float = 1.0,
) -> tuple[np.ndarray, list[bool]]:
    """Embed texts via omlx. Returns (embeddings shape (N,D) float32, success_mask)."""

    return _embed_omlx(texts, batch_size, retry_max, base_delay)


def _embed_omlx(
    texts: Sequence[str],
    batch_size: int,
    retry_max: int,
    base_delay: float,
) -> tuple[np.ndarray, list[bool]]:
    if not texts:
        return np.zeros((0, DEFAULT_EMBEDDING_DIM), dtype=np.float32), []

    if batch_size <= 0:
        raise PipelineConfigurationError("Embedding batch_size must be greater than 0.")
    api_key = os.getenv("OMLX_API_KEY")
    if not api_key:
        raise PipelineConfigurationError("OMLX_API_KEY must be configured for intent embedding.")

    rows: list[np.ndarray | None] = []
    success_mask: list[bool] = []
    embedding_dim: int | None = None

    with httpx.Client(
        base_url=os.getenv("OMLX_BASE_URL", DEFAULT_OMLX_BASE_URL),
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=30.0,
    ) as client:
        for start in range(0, len(texts), batch_size):
            texts_batch = list(texts[start : start + batch_size])
            payload = _post_embeddings(
                client,
                os.getenv("MODEL_NAME", DEFAULT_MODEL_NAME),
                texts_batch,
                retry_max,
                base_delay,
            )
            if payload is None:
                rows.extend([None] * len(texts_batch))
                success_mask.extend([False] * len(texts_batch))
                continue

            parsed_rows = _pad_batch(_parse_response_embeddings(payload), len(texts_batch))
            for vector in parsed_rows:
                if vector.size > 0:
                    candidate_dim = _embedding_size(vector)
                    dim_to_check = embedding_dim if embedding_dim is not None else candidate_dim
                    if _is_valid_embedding(vector, dim_to_check):
                        if embedding_dim is None:
                            embedding_dim = candidate_dim
                        rows.append(vector.astype(np.float32, copy=False))
                        success_mask.append(True)
                        continue
                rows.append(None)
                success_mask.append(False)

    final_dim = embedding_dim or DEFAULT_EMBEDDING_DIM
    embeddings = np.vstack([row if row is not None else np.zeros((final_dim,), dtype=np.float32) for row in rows])
    return _l2norm(embeddings), success_mask


def _post_embeddings(
    client: httpx.Client,
    model: str,
    texts_batch: Sequence[str],
    retry_max: int,
    base_delay: float,
) -> object | None:
    max_attempts = max(1, retry_max)
    for attempt in range(max_attempts):
        try:
            response = client.post("/embeddings", json={"model": model, "input": list(texts_batch)})
        except httpx.HTTPError:
            if attempt < max_attempts - 1:
                _sleep_before_retry(base_delay, attempt)
                continue
            return None

        if response.status_code == 429 or response.status_code >= 500:
            if attempt < max_attempts - 1:
                _sleep_before_retry(base_delay, attempt)
                continue
            return None

        if response.status_code >= 400:
            return None

        try:
            # httpx JSON payload is untyped; downstream parsing validates the shape.
            payload: object = response.json()  # pyright: ignore[reportAny]
        except ValueError:
            return None
        return payload

    return None


def _sleep_before_retry(base_delay: float, attempt: int) -> None:
    delay = base_delay * (1 << attempt)
    if delay > 0.0:
        time.sleep(delay)


def _parse_response_embeddings(payload: object) -> list[np.ndarray]:
    if not _is_json_object(payload):
        return []

    data = payload.get("data")
    if not _is_object_list(data):
        return []

    rows: list[np.ndarray] = []
    for item in data:
        embedding = item.get("embedding") if _is_json_object(item) else None
        rows.append(_coerce_embedding(embedding))
    return rows


def _pad_batch(vectors: list[np.ndarray], batch_len: int) -> list[np.ndarray]:
    missing = max(0, batch_len - len(vectors))
    return (vectors + [np.zeros((0,), dtype=np.float32)] * missing)[:batch_len]


def _is_valid_embedding(vector: np.ndarray, embedding_dim: int | None) -> bool:
    return vector.size > 0 and _embedding_size(vector) == embedding_dim and _embedding_norm(vector) > 0.0


def _embedding_size(vector: np.ndarray) -> int:
    return len(vector)


def _embedding_norm(vector: np.ndarray) -> float:
    return float(np.linalg.norm(vector))


def _coerce_embedding(value: object) -> np.ndarray:
    if not _is_object_list(value):
        return np.zeros((0,), dtype=np.float32)
    try:
        return np.asarray(value, dtype=np.float32)
    except (TypeError, ValueError):
        return np.zeros((0,), dtype=np.float32)


def _is_json_object(value: object) -> TypeGuard[Mapping[str, object]]:
    return isinstance(value, Mapping)


def _is_object_list(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


def _l2norm(vectors: np.ndarray) -> np.ndarray:
    values = vectors.astype(np.float32, copy=True)
    # numpy linalg stubs expose Any; values are fixed float32 arrays here.
    norms = np.linalg.norm(values, axis=1, keepdims=True)  # pyright: ignore[reportAny]
    normalized = np.zeros_like(values, dtype=np.float32)
    _ = np.divide(values, norms, out=normalized, where=norms > 0.0)  # pyright: ignore[reportAny]
    return normalized.astype(np.float32, copy=False)


__all__ = ["embed_texts"]
