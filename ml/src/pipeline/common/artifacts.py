from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext


def ensure_stage_directory(stage_context: StageContext, runtime_config: PipelineRuntimeConfig) -> Path:
    artifact_dir = stage_context.artifact_dir(runtime_config)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    return artifact_dir


def write_stage_manifest(
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
    payload: dict[str, Any],
) -> Path:
    artifact_dir = ensure_stage_directory(stage_context, runtime_config)
    manifest_path = artifact_dir / "manifest.json"
    manifest = {
        "dag_id": stage_context.dag_id,
        "run_id": stage_context.run_id,
        "stage_name": stage_context.stage_name,
        "workspace_id": stage_context.workspace_id,
        "dataset_id": stage_context.dataset_id,
        "pipeline_job_id": stage_context.pipeline_job_id,
        "artifact_root": str(runtime_config.artifact_root),
        "generated_at": datetime.now(UTC).isoformat(),
        "payload": payload,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest_path
