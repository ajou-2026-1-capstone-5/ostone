from __future__ import annotations

import os
from dataclasses import dataclass
from math import isfinite
from pathlib import Path

from pipeline.common.exceptions import PipelineConfigurationError

DEFAULT_ARTIFACT_STORE = "local"
DEFAULT_EMBEDDING_MODEL_NAME = "BAAI/bge-m3"
DEFAULT_EMBEDDING_RUNTIME = "flag_embedding"
DEFAULT_LLM_MODEL_NAME = "Qwen/Qwen3-14B"
DEFAULT_RUNTIME_PROFILE = "balanced"
DEFAULT_GPU_TASK_MODE = "run_task"


@dataclass(frozen=True)
class PipelineRuntimeConfig:
    artifact_root: Path
    backend_base_url: str
    callback_enabled: bool = False
    callback_timeout_seconds: float = 10.0
    airflow_webhook_secret: str | None = None
    artifact_store: str = DEFAULT_ARTIFACT_STORE
    artifact_bucket: str | None = None
    artifact_prefix: str = ""
    embedding_model_name: str = DEFAULT_EMBEDDING_MODEL_NAME
    embedding_runtime: str = DEFAULT_EMBEDDING_RUNTIME
    llm_model_name: str = DEFAULT_LLM_MODEL_NAME
    llm_runtime_base_url: str | None = None
    llm_runtime_api_key: str | None = None
    runtime_profile: str = DEFAULT_RUNTIME_PROFILE
    gpu_task_mode: str = DEFAULT_GPU_TASK_MODE

    def __post_init__(self) -> None:
        airflow_webhook_secret = _normalize_optional_secret(self.airflow_webhook_secret)
        if self.callback_enabled and not airflow_webhook_secret:
            raise PipelineConfigurationError("AIRFLOW_WEBHOOK_SECRET must not be blank when callbacks are enabled.")
        object.__setattr__(self, "airflow_webhook_secret", airflow_webhook_secret)
        artifact_store = self.artifact_store.strip().lower()
        if artifact_store not in {"local", "s3"}:
            raise PipelineConfigurationError("ML_ARTIFACT_STORE must be one of: local, s3.")
        if artifact_store == "s3":
            if not _normalize_optional_secret(self.artifact_bucket):
                raise PipelineConfigurationError("ML_ARTIFACT_BUCKET must not be blank when ML_ARTIFACT_STORE=s3.")
        runtime_profile = self.runtime_profile.strip().lower()
        if runtime_profile not in {"balanced", "quality"}:
            raise PipelineConfigurationError("ML_RUNTIME_PROFILE must be one of: balanced, quality.")
        embedding_runtime = self.embedding_runtime.strip().lower()
        if embedding_runtime != DEFAULT_EMBEDDING_RUNTIME:
            raise PipelineConfigurationError(
                "Only ML_EMBEDDING_RUNTIME=flag_embedding is supported. "
                "Hash, fake, and cheap embedding paths have been removed."
            )
        gpu_task_mode = self.gpu_task_mode.strip().lower()
        if gpu_task_mode not in {"run_task", "service"}:
            raise PipelineConfigurationError("GPU_TASK_MODE must be one of: run_task, service.")
        object.__setattr__(self, "artifact_store", artifact_store)
        object.__setattr__(self, "artifact_bucket", _normalize_optional_secret(self.artifact_bucket))
        object.__setattr__(self, "artifact_prefix", self.artifact_prefix.strip().strip("/"))
        object.__setattr__(
            self,
            "embedding_model_name",
            self.embedding_model_name.strip() or DEFAULT_EMBEDDING_MODEL_NAME,
        )
        object.__setattr__(self, "embedding_runtime", embedding_runtime)
        object.__setattr__(self, "llm_model_name", self.llm_model_name.strip() or DEFAULT_LLM_MODEL_NAME)
        object.__setattr__(self, "llm_runtime_base_url", _normalize_optional_secret(self.llm_runtime_base_url))
        object.__setattr__(self, "llm_runtime_api_key", _normalize_optional_secret(self.llm_runtime_api_key))
        object.__setattr__(self, "runtime_profile", runtime_profile)
        object.__setattr__(self, "gpu_task_mode", gpu_task_mode)

    @classmethod
    def from_env(cls) -> "PipelineRuntimeConfig":
        artifact_root = os.getenv("PIPELINE_ARTIFACT_ROOT", "/opt/airflow/artifacts").strip()
        backend_base_url = (os.getenv("PIPELINE_BACKEND_BASE_URL") or "").strip()
        callback_enabled = _parse_bool(os.getenv("PIPELINE_CALLBACK_ENABLED", "true"))
        callback_timeout_seconds = _parse_timeout(os.getenv("PIPELINE_CALLBACK_TIMEOUT_SECONDS", "10"))
        airflow_webhook_secret = os.getenv("AIRFLOW_WEBHOOK_SECRET")
        artifact_store = os.getenv("ML_ARTIFACT_STORE", DEFAULT_ARTIFACT_STORE)
        artifact_bucket = os.getenv("ML_ARTIFACT_BUCKET")
        artifact_prefix = os.getenv("ML_ARTIFACT_PREFIX", "")
        embedding_model_name = os.getenv("EMBEDDING_MODEL_NAME", DEFAULT_EMBEDDING_MODEL_NAME)
        embedding_runtime = _embedding_runtime_from_env()
        llm_model_name = os.getenv("LLM_MODEL_NAME", DEFAULT_LLM_MODEL_NAME)
        llm_runtime_base_url = os.getenv("LLM_RUNTIME_BASE_URL")
        llm_runtime_api_key = os.getenv("LLM_RUNTIME_API_KEY")
        runtime_profile = os.getenv("ML_RUNTIME_PROFILE", DEFAULT_RUNTIME_PROFILE)
        gpu_task_mode = os.getenv("GPU_TASK_MODE", DEFAULT_GPU_TASK_MODE)
        if not artifact_root:
            raise PipelineConfigurationError("PIPELINE_ARTIFACT_ROOT must not be blank.")
        if not backend_base_url:
            raise PipelineConfigurationError("PIPELINE_BACKEND_BASE_URL must not be blank.")
        return cls(
            artifact_root=Path(artifact_root),
            backend_base_url=backend_base_url.rstrip("/"),
            callback_enabled=callback_enabled,
            callback_timeout_seconds=callback_timeout_seconds,
            airflow_webhook_secret=airflow_webhook_secret,
            artifact_store=artifact_store,
            artifact_bucket=artifact_bucket,
            artifact_prefix=artifact_prefix,
            embedding_model_name=embedding_model_name,
            embedding_runtime=embedding_runtime,
            llm_model_name=llm_model_name,
            llm_runtime_base_url=llm_runtime_base_url,
            llm_runtime_api_key=llm_runtime_api_key,
            runtime_profile=runtime_profile,
            gpu_task_mode=gpu_task_mode,
        )


def _embedding_runtime_from_env() -> str:
    value = os.getenv("ML_EMBEDDING_RUNTIME")
    if value is None or not value.strip():
        return DEFAULT_EMBEDDING_RUNTIME
    normalized = value.strip().lower()
    if normalized != DEFAULT_EMBEDDING_RUNTIME:
        raise PipelineConfigurationError(
            "ML_EMBEDDING_RUNTIME no longer supports alternate runtimes. Use flag_embedding with BAAI/bge-m3."
        )
    return DEFAULT_EMBEDDING_RUNTIME


def _parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    raise PipelineConfigurationError("PIPELINE_CALLBACK_ENABLED must be a boolean value.")


def _normalize_optional_secret(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _parse_timeout(value: str) -> float:
    try:
        timeout = float(value)
    except ValueError as exc:
        raise PipelineConfigurationError("PIPELINE_CALLBACK_TIMEOUT_SECONDS must be a number.") from exc
    if not isfinite(timeout) or timeout <= 0:
        raise PipelineConfigurationError("PIPELINE_CALLBACK_TIMEOUT_SECONDS must be a finite number greater than 0.")
    return timeout
