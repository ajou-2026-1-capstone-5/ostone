from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest

from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.evaluation import main as evaluation
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


def test_evaluation_uses_existing_relative_candidate_artifact(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    candidate_path = tmp_path / "candidate.json"
    candidate_path.write_text(
        json.dumps(
            {
                "schemaVersion": "1.0",
                "domainPackDraft": {"packKey": "existing", "packName": "Existing"},
                "intentDraft": {"intents": []},
                "workflowDraft": {"workflows": []},
            }
        ),
        encoding="utf-8",
    )
    manifest_path = _write_manifest(tmp_path, {"candidateArtifactPath": candidate_path.name})
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

    result = run(str(manifest_path))

    publish_candidate_path = Path(cast(str, result["candidateArtifactPath"]))
    publish_candidate = json.loads(publish_candidate_path.read_text(encoding="utf-8"))
    assert publish_candidate["domainPackDraft"]["packKey"] == "existing"
    assert publish_candidate["evaluationSummary"]["passed"] is True


def test_load_candidate_rejects_invalid_upstream_manifest(tmp_path: Path) -> None:
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text("{not-json", encoding="utf-8")

    with pytest.raises(PipelineStageError, match="Invalid upstream manifest JSON"):
        evaluation._load_or_create_candidate(str(manifest_path))


def test_load_candidate_rejects_invalid_candidate_json(tmp_path: Path) -> None:
    candidate_path = tmp_path / "candidate.json"
    candidate_path.write_text("{not-json", encoding="utf-8")
    manifest_path = _write_manifest(tmp_path, {"candidateArtifactPath": str(candidate_path)})

    with pytest.raises(PipelineStageError, match="Invalid candidate artifact JSON"):
        evaluation._load_or_create_candidate(str(manifest_path))


def test_load_candidate_requires_candidate_object(tmp_path: Path) -> None:
    candidate_path = tmp_path / "candidate.json"
    candidate_path.write_text("[]", encoding="utf-8")
    manifest_path = _write_manifest(tmp_path, {"candidateArtifactPath": str(candidate_path)})

    with pytest.raises(PipelineStageError, match="Candidate artifact must be a JSON object"):
        evaluation._load_or_create_candidate(str(manifest_path))
