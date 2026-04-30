from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest


def test_stage_return_payload_is_merged_into_manifest(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    pytest.importorskip("airflow.sdk")
    from dags import domain_pack_generation as dag_module

    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setattr(
        dag_module,
        "get_current_context",
        lambda: {
            "dag": type("Dag", (), {"dag_id": "domain_pack_generation"})(),
            "run_id": "manual__run",
            "params": {"workspace_id": "3", "dataset_id": "5", "pipeline_job_id": "11"},
        },
    )

    def stage_callable(_upstream_manifest_path: str | None) -> dict[str, Any]:
        return {"candidateArtifactPath": "/tmp/publish_candidate_input.json"}

    result = dag_module._run_stage("evaluation", stage_callable)
    manifest_path = Path(result["artifact_manifest_path"])
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert manifest["payload"]["status"] == "completed"
    assert manifest["payload"]["candidateArtifactPath"] == "/tmp/publish_candidate_input.json"
