from __future__ import annotations

import json
import math
import os
import platform
import urllib.error
import urllib.request
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlparse

import numpy as np

from pipeline.common.config import DEFAULT_EMBEDDING_RUNTIME, LOCAL_HTTP_EMBEDDING_RUNTIME, PipelineRuntimeConfig
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

    def __init__(self, model_name: str, runtime_profile: str, *, auto_device: bool = False) -> None:
        self.model_name = model_name
        self.runtime_profile = runtime_profile
        self.batch_size = _positive_int_env("EMBEDDING_RUNTIME_BATCH_SIZE", default=8)
        self.max_length = _positive_int_env("EMBEDDING_MAX_LENGTH", default=_default_max_length(runtime_profile))
        self.dim = _positive_int_env("EMBEDDING_DIM", default=1024)
        self.use_fp16 = _bool_env("EMBEDDING_USE_FP16", default=False)
        self.require_accelerator = _bool_env("EMBEDDING_REQUIRE_ACCELERATOR", default=False)
        self.device = _embedding_device(auto_device)
        if self.require_accelerator:
            self.device = _required_cuda_device(self.device)
        try:
            from FlagEmbedding import BGEM3FlagModel  # type: ignore[import-not-found, import-untyped]
        except ImportError as exc:
            raise PipelineConfigurationError(
                "ML_EMBEDDING_RUNTIME=flag_embedding requires optional local dependencies. "
                "Install FlagEmbedding and torch, then retry."
            ) from exc
        kwargs: dict[str, object] = {"use_fp16": self.use_fp16}
        if self.device:
            kwargs["devices"] = self.device
        self._model: object = BGEM3FlagModel(model_name, **kwargs)

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


class HttpEmbeddingRuntime:
    """Embedding runtime that delegates inference to a host-local HTTP worker."""

    def __init__(self, model_name: str, runtime_profile: str) -> None:
        self.model_name = model_name
        self.runtime_profile = runtime_profile
        self.base_url = _required_url_env("EMBEDDING_RUNTIME_BASE_URL").rstrip("/")
        self.timeout_seconds = _positive_float_env("EMBEDDING_RUNTIME_TIMEOUT_SECONDS", default=1800.0)
        self.dim = _positive_int_env("EMBEDDING_DIM", default=1024)

    def embed(self, texts: Sequence[str]) -> EmbeddingResult:
        if not texts:
            return EmbeddingResult(
                embeddings=np.zeros((0, self.dim), dtype=np.float32),
                success_mask=[],
                model_name=self.model_name,
                runtime_profile=self.runtime_profile,
            )
        payload = {
            "texts": list(texts),
            "modelName": self.model_name,
            "runtimeProfile": self.runtime_profile,
        }
        request = urllib.request.Request(
            f"{self.base_url}/v1/embeddings",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read()
        except (urllib.error.URLError, TimeoutError) as exc:
            raise PipelineConfigurationError(f"Local embedding worker request failed: {exc}") from exc
        try:
            response_payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise PipelineConfigurationError("Local embedding worker returned invalid JSON.") from exc
        if not isinstance(response_payload, dict):
            raise PipelineConfigurationError("Local embedding worker returned a non-object JSON response.")
        embeddings = _dense_embeddings(response_payload.get("embeddings"))
        success_mask = response_payload.get("successMask")
        if (
            not isinstance(success_mask, list)
            or len(success_mask) != len(texts)
            or any(not isinstance(value, bool) for value in success_mask)
        ):
            raise PipelineConfigurationError("Local embedding worker returned an invalid successMask.")
        if embeddings.shape[0] != len(texts):
            raise PipelineConfigurationError(
                "Local embedding worker returned an embedding count that does not match the input."
            )
        self.dim = embeddings.shape[1]
        return EmbeddingResult(
            embeddings=_l2norm(embeddings),
            success_mask=success_mask,
            model_name=str(response_payload.get("modelName") or self.model_name),
            runtime_profile=str(response_payload.get("runtimeProfile") or self.runtime_profile),
        )


def build_embedding_runtime(runtime_config: PipelineRuntimeConfig | None = None) -> EmbeddingRuntime:
    if runtime_config is None:
        runtime_config = PipelineRuntimeConfig.from_env()
    if runtime_config.embedding_runtime == LOCAL_HTTP_EMBEDDING_RUNTIME:
        return HttpEmbeddingRuntime(
            model_name=runtime_config.embedding_model_name,
            runtime_profile=runtime_config.runtime_profile,
        )
    if runtime_config.embedding_runtime != DEFAULT_EMBEDDING_RUNTIME:
        raise PipelineConfigurationError("Unsupported embedding runtime.")
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


def _positive_float_env(key: str, default: float) -> float:
    value = os.getenv(key, "").strip()
    if not value:
        return default
    try:
        parsed = float(value)
    except ValueError as exc:
        raise PipelineConfigurationError(f"{key} must be a positive number.") from exc
    if not math.isfinite(parsed) or parsed <= 0:
        raise PipelineConfigurationError(f"{key} must be a positive number.")
    return parsed


def _required_url_env(key: str) -> str:
    value = os.getenv(key, "").strip()
    if not value:
        raise PipelineConfigurationError(f"{key} must not be blank when ML_EMBEDDING_RUNTIME=local_http.")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise PipelineConfigurationError(f"{key} must be an http(s) URL.")
    return value


def _bool_env(key: str, default: bool) -> bool:
    value = os.getenv(key, "").strip().lower()
    if not value:
        return default
    if value in {"1", "true", "yes", "y", "on"}:
        return True
    if value in {"0", "false", "no", "n", "off"}:
        return False
    raise PipelineConfigurationError(f"{key} must be a boolean value.")


def _default_max_length(runtime_profile: str) -> int:
    return 8192 if runtime_profile.strip().lower() == "quality" else 1024


def _embedding_device(auto_device: bool) -> str | None:
    value = os.getenv("EMBEDDING_DEVICE", "").strip().lower()
    if value and value != "auto":
        return value
    if value != "auto" and not auto_device:
        return None
    if platform.system().lower() != "darwin":
        return None
    try:
        import torch
    except ImportError:
        return None
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return "mps"
    return None


def _required_cuda_device(device: str | None) -> str:
    if device and not device.startswith("cuda"):
        raise PipelineConfigurationError("EMBEDDING_REQUIRE_ACCELERATOR requires EMBEDDING_DEVICE to be cuda.")
    try:
        import torch
    except ImportError as exc:
        raise PipelineConfigurationError("EMBEDDING_REQUIRE_ACCELERATOR requires torch with CUDA support.") from exc
    try:
        cuda_available = bool(torch.cuda.is_available())
    except Exception as exc:
        raise PipelineConfigurationError("CUDA availability check failed for embedding runtime.") from exc
    if not cuda_available:
        raise PipelineConfigurationError(
            "CUDA is unavailable for the required embedding runtime. "
            "Check the GPU host driver and the torch CUDA wheel before retrying."
        )
    return device or "cuda"


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
    "HttpEmbeddingRuntime",
    "build_embedding_runtime",
    "cosine_similarity",
]
