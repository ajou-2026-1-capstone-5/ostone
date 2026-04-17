from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from pipeline.common.exceptions import PipelineConfigurationError


@dataclass(frozen=True)
class PipelineRuntimeConfig:
    artifact_root: Path
    backend_base_url: str

    @classmethod
    def from_env(cls) -> "PipelineRuntimeConfig":
        artifact_root = os.getenv("PIPELINE_ARTIFACT_ROOT", "/opt/airflow/artifacts")
        backend_base_url = os.getenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
        if not artifact_root:
            raise PipelineConfigurationError("PIPELINE_ARTIFACT_ROOT must not be blank.")
        if not backend_base_url:
            raise PipelineConfigurationError("PIPELINE_BACKEND_BASE_URL must not be blank.")
        return cls(artifact_root=Path(artifact_root), backend_base_url=backend_base_url.rstrip("/"))
