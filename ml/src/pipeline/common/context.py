from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from pipeline.common.config import PipelineRuntimeConfig


@dataclass(frozen=True)
class StageContext:
    dag_id: str
    run_id: str
    stage_name: str
    workspace_id: str | None = None
    dataset_id: str | None = None
    pipeline_job_id: str | None = None

    def artifact_dir(self, runtime_config: PipelineRuntimeConfig) -> Path:
        safe_run_id = self.run_id.replace("/", "__")
        return runtime_config.artifact_root / self.dag_id / safe_run_id / self.stage_name
