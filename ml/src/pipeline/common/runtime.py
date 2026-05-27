from __future__ import annotations

import hashlib
import math
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineConfigurationError

DEFAULT_EMBEDDING_DIM = 768


@dataclass(frozen=True)
class EmbeddingResult:
    embeddings: np.ndarray
    success_mask: list[bool]
    model_name: str
    runtime_profile: str


class LocalEmbeddingRuntime:
    """Deterministic local embedding runtime used for CI, smoke tests, and cheap profile.

    Production deployments can replace this class behind the same contract with an
    ECS-backed model task that loads BAAI/bge-m3 directly. This fallback deliberately
    does not call an external embedding API.
    """

    def __init__(self, model_name: str, runtime_profile: str, dim: int = DEFAULT_EMBEDDING_DIM) -> None:
        if dim <= 0:
            raise PipelineConfigurationError("Embedding dimension must be greater than 0.")
        self.model_name = model_name
        self.runtime_profile = runtime_profile
        self.dim = dim

    def embed(self, texts: Sequence[str]) -> EmbeddingResult:
        rows: list[np.ndarray] = []
        success_mask: list[bool] = []
        for text in texts:
            normalized = text.strip()
            if not normalized:
                rows.append(np.zeros((self.dim,), dtype=np.float32))
                success_mask.append(False)
                continue
            rows.append(_hashed_text_vector(normalized, self.dim))
            success_mask.append(True)
        if rows:
            embeddings = np.vstack(rows).astype(np.float32, copy=False)
        else:
            embeddings = np.zeros((0, self.dim), dtype=np.float32)
        return EmbeddingResult(
            embeddings=_l2norm(embeddings),
            success_mask=success_mask,
            model_name=self.model_name,
            runtime_profile=self.runtime_profile,
        )


def build_embedding_runtime(runtime_config: PipelineRuntimeConfig | None = None) -> LocalEmbeddingRuntime:
    if runtime_config is None:
        runtime_config = PipelineRuntimeConfig.from_env()
    return LocalEmbeddingRuntime(
        model_name=runtime_config.embedding_model_name,
        runtime_profile=runtime_config.runtime_profile,
    )


def _hashed_text_vector(text: str, dim: int) -> np.ndarray:
    vector = np.zeros((dim,), dtype=np.float32)
    tokens = _char_ngrams(text)
    if not tokens:
        tokens = (text,)
    for token in tokens:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=16).digest()
        index = int.from_bytes(digest[:8], "big") % dim
        sign = 1.0 if digest[8] % 2 == 0 else -1.0
        vector[index] += sign
    return vector


def _char_ngrams(text: str) -> tuple[str, ...]:
    compact = " ".join(text.lower().split())
    if len(compact) <= 3:
        return (compact,)
    max_n = min(5, len(compact))
    tokens: list[str] = []
    for n in range(2, max_n + 1):
        tokens.extend(compact[start : start + n] for start in range(0, len(compact) - n + 1))
    return tuple(tokens)


def _l2norm(vectors: np.ndarray) -> np.ndarray:
    values = vectors.astype(np.float32, copy=True)
    norms = np.linalg.norm(values, axis=1, keepdims=True)
    normalized = np.zeros_like(values, dtype=np.float32)
    _ = np.divide(values, norms, out=normalized, where=norms > 0.0)
    return normalized.astype(np.float32, copy=False)


def cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    left_norm = float(np.linalg.norm(left))
    right_norm = float(np.linalg.norm(right))
    if math.isclose(left_norm, 0.0) or math.isclose(right_norm, 0.0):
        return 0.0
    return float(np.dot(left, right) / (left_norm * right_norm))


__all__ = [
    "DEFAULT_EMBEDDING_DIM",
    "EmbeddingResult",
    "LocalEmbeddingRuntime",
    "build_embedding_runtime",
    "cosine_similarity",
]
