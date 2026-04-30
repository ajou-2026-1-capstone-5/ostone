from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from pipeline.stages.evaluation.main import run


def _write_manifest(tmp_path: Path, payload: dict[str, object] | None = None) -> Path:
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__run",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "11",
                "payload": payload or {},
            }
        ),
        encoding="utf-8",
    )
    return manifest_path


def test_evaluation_manifest_contains_candidate_artifact_path(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    manifest_path = _write_manifest(tmp_path)

    result = run(str(manifest_path))

    candidate_path = Path(cast(str, result["candidateArtifactPath"]))
    candidate = cast(dict[str, Any], json.loads(candidate_path.read_text(encoding="utf-8")))
    assert candidate_path == (
        artifact_root / "domain_pack_generation" / "manual__run" / "evaluation" / "publish_candidate_input.json"
    )
    assert candidate["schemaVersion"] == "1.0"
    assert candidate["evaluationSummary"]["passed"] is True
