from __future__ import annotations

import math
import os
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

import numpy as np

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineConfigurationError

DEFAULT_EMBEDDING_DIM = 1024


@dataclass(frozen=True)
class EmbeddingResult:
    embeddings: np.ndarray
    success_mask: list[bool]
    model_name: str
    runtime_profile: str


class EmbeddingRuntime(Protocol):
    model_name: str
    runtime_profile: str

    def embed(self, texts: Sequence[str]) -> EmbeddingResult: ...


class FlagEmbeddingRuntime:
    """Local BGE-M3 runtime backed by FlagEmbedding.

    The pipeline no longer has a fake/hash embedding option. Tests should inject a
    fake FlagEmbedding module or monkeypatch build_embedding_runtime explicitly.
    """

    def __init__(self, model_name: str, runtime_profile: str) -> None:
        self.model_name = model_name
        self.runtime_profile = runtime_profile
        self.batch_size = _positive_int_env("EMBEDDING_RUNTIME_BATCH_SIZE", default=8)
        self.max_length = _positive_int_env("EMBEDDING_MAX_LENGTH", default=8192)
        self.dim = _positive_int_env("EMBEDDING_DIM", default=1024)
        self.use_fp16 = _bool_env("EMBEDDING_USE_FP16", default=False)
        try:
            from FlagEmbedding import BGEM3FlagModel  # type: ignore[import-not-found, import-untyped]
        except ImportError as exc:
            raise PipelineConfigurationError(
                "ML_EMBEDDING_RUNTIME=flag_embedding requires optional local dependencies. "
                "Install FlagEmbedding and torch, then retry."
            ) from exc
        self._model: object = BGEM3FlagModel(model_name, use_fp16=self.use_fp16)

    def embed(self, texts: Sequence[str]) -> EmbeddingResult:
        normalized_texts = [text.strip() for text in texts]
        success_mask = [bool(text) for text in normalized_texts]
        valid_texts = [text for text in normalized_texts if text]
        if not texts:
            return EmbeddingResult(
                embeddings=np.zeros((0, self.dim), dtype=np.float32),
                success_mask=[],
                model_name=self.model_name,
                runtime_profile=self.runtime_profile,
            )
        if not valid_texts:
            return EmbeddingResult(
                embeddings=np.zeros((len(texts), self.dim), dtype=np.float32),
                success_mask=success_mask,
                model_name=self.model_name,
                runtime_profile=self.runtime_profile,
            )

        encoded = getattr(self._model, "encode")(
            valid_texts,
            batch_size=self.batch_size,
            max_length=self.max_length,
            return_dense=True,
            return_sparse=False,
            return_colbert_vecs=False,
        )
        valid_embeddings = _dense_embeddings(encoded)
        self.dim = valid_embeddings.shape[1]
        output = np.zeros((len(texts), valid_embeddings.shape[1]), dtype=np.float32)
        valid_index = 0
        for row_index, success in enumerate(success_mask):
            if not success:
                continue
            output[row_index] = valid_embeddings[valid_index]
            valid_index += 1
        return EmbeddingResult(
            embeddings=_l2norm(output),
            success_mask=success_mask,
            model_name=self.model_name,
            runtime_profile=self.runtime_profile,
        )


def build_embedding_runtime(runtime_config: PipelineRuntimeConfig | None = None) -> EmbeddingRuntime:
    if runtime_config is None:
        runtime_config = PipelineRuntimeConfig.from_env()
    return FlagEmbeddingRuntime(
        model_name=runtime_config.embedding_model_name,
        runtime_profile=runtime_config.runtime_profile,
    )


def _l2norm(vectors: np.ndarray) -> np.ndarray:
    values = vectors.astype(np.float32, copy=True)
    norms = np.linalg.norm(values, axis=1, keepdims=True)
    normalized = np.zeros_like(values, dtype=np.float32)
    _ = np.divide(values, norms, out=normalized, where=norms > 0.0)
    return normalized.astype(np.float32, copy=False)


def _dense_embeddings(encoded: object) -> np.ndarray:
    dense = encoded.get("dense_vecs") if isinstance(encoded, dict) else encoded
    values = np.asarray(dense, dtype=np.float32)
    if values.ndim == 1:
        values = values.reshape((1, values.shape[0]))
    if values.ndim != 2 or values.shape[1] <= 0:
        raise PipelineConfigurationError("FlagEmbedding dense embeddings must be a non-empty 2D array.")
    return values.astype(np.float32, copy=False)


def _positive_int_env(key: str, default: int) -> int:
    value = os.getenv(key, "").strip()
    if not value:
        return default
    try:
        parsed = int(value)
    except ValueError as exc:
        raise PipelineConfigurationError(f"{key} must be a positive integer.") from exc
    if parsed <= 0:
        raise PipelineConfigurationError(f"{key} must be a positive integer.")
    return parsed


def _bool_env(key: str, default: bool) -> bool:
    value = os.getenv(key, "").strip().lower()
    if not value:
        return default
    if value in {"1", "true", "yes", "y", "on"}:
        return True
    if value in {"0", "false", "no", "n", "off"}:
        return False
    raise PipelineConfigurationError(f"{key} must be a boolean value.")


def cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    left_norm = float(np.linalg.norm(left))
    right_norm = float(np.linalg.norm(right))
    if math.isclose(left_norm, 0.0) or math.isclose(right_norm, 0.0):
        return 0.0
    return float(np.dot(left, right) / (left_norm * right_norm))


__all__ = [
    "DEFAULT_EMBEDDING_DIM",
    "EmbeddingResult",
    "EmbeddingRuntime",
    "FlagEmbeddingRuntime",
    "build_embedding_runtime",
    "cosine_similarity",
]
