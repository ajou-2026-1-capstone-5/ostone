from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def write_json_artifact(path: Path, payload: dict[str, Any] | list[Any]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def write_stage_manifest(
    manifest_path: Path,
    *,
    dag_id: str = "domain_pack_generation",
    run_id: str = "manual__run",
    stage_name: str | None = None,
    workspace_id: str = "3",
    dataset_id: str = "5",
    pipeline_job_id: str = "11",
    payload: dict[str, Any] | None = None,
) -> Path:
    manifest: dict[str, Any] = {
        "dag_id": dag_id,
        "run_id": run_id,
        "workspace_id": workspace_id,
        "dataset_id": dataset_id,
        "pipeline_job_id": pipeline_job_id,
        "payload": payload or {},
    }
    if stage_name is not None:
        manifest["stage_name"] = stage_name
    return write_json_artifact(manifest_path, manifest)
