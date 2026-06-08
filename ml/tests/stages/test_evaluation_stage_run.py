from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest

from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.stages.evaluation import main as evaluation
from pipeline.stages.evaluation.main import run
from tests.helpers.evaluation import (
    _candidate_with_metrics,
    _write_manifest,
)


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


def test_evaluation_requires_upstream_manifest() -> None:
    with pytest.raises(PipelineConfigurationError, match="evaluation stage requires an upstream manifest path"):
        run()


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
    assert publish_candidate["evaluationSummary"]["passed"] is False
    assert "mapping_rate_below_threshold" in publish_candidate["evaluationSummary"]["blockReasons"]


def test_evaluation_writes_replay_lift_summary_when_source_run_is_available(
    monkeypatch,
    tmp_path: Path,
) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    source_run_dir = artifact_root / "domain_pack_generation" / "manual__source"
    replay_run_dir = artifact_root / "domain_pack_generation" / "manual__replay"
    source_representation_manifest = source_run_dir / "representation" / "manifest.json"
    replay_representation_manifest = replay_run_dir / "representation" / "manifest.json"
    replay_intent_manifest = replay_run_dir / "intent_discovery" / "manifest.json"
    replay_flow_manifest = replay_run_dir / "flow_splitting" / "manifest.json"
    replay_draft_dir = replay_run_dir / "draft_generation"
    replay_draft_manifest = replay_draft_dir / "manifest.json"
    source_candidate_path = source_run_dir / "evaluation" / "publish_candidate_input.json"
    after_candidate_path = replay_draft_dir / "candidate.json"
    for path in (
        source_representation_manifest,
        replay_representation_manifest,
        replay_intent_manifest,
        replay_flow_manifest,
        replay_draft_manifest,
        source_candidate_path,
        after_candidate_path,
    ):
        path.parent.mkdir(parents=True, exist_ok=True)

    source_representation_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__source",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "41",
                "payload": {},
            }
        ),
        encoding="utf-8",
    )
    replay_representation_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__replay",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "42",
                "payload": {"upstream_manifest_path": str(source_representation_manifest)},
            }
        ),
        encoding="utf-8",
    )
    replay_intent_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__replay",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "42",
                "payload": {"upstream_manifest_path": str(replay_representation_manifest)},
            }
        ),
        encoding="utf-8",
    )
    replay_flow_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__replay",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "42",
                "payload": {"upstream_manifest_path": str(replay_intent_manifest)},
            }
        ),
        encoding="utf-8",
    )
    replay_draft_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__replay",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "42",
                "payload": {
                    "candidateArtifactPath": after_candidate_path.name,
                    "upstream_manifest_path": str(replay_flow_manifest),
                },
            }
        ),
        encoding="utf-8",
    )
    source_candidate_path.write_text(
        json.dumps(
            _candidate_with_metrics(
                {
                    "reviewRequiredRate": 0.8,
                    "highConfidenceWorkflowCount": 0,
                    "duplicateLabelRate": 0.5,
                    "entrypointSemanticSeparationMargin": 0.2,
                    "positiveMarginRate": 0.6,
                    "sameIntentGraphConflictPairRate": 0.1,
                },
                block_reasons=["mapping_rate_below_threshold"],
            )
        ),
        encoding="utf-8",
    )
    after_candidate_path.write_text(
        json.dumps(
            _candidate_with_metrics(
                {
                    "reviewRequiredRate": 0.9,
                    "highConfidenceWorkflowCount": 0,
                    "duplicateLabelRate": 0.4,
                    "entrypointSemanticSeparationMargin": 0.1,
                    "positiveMarginRate": 0.7,
                    "sameIntentGraphConflictPairRate": 0.2,
                }
            )
        ),
        encoding="utf-8",
    )

    result = run(str(replay_draft_manifest))

    assert result["replayReportPath"] == "replay_lift_summary.json"
    publish_candidate_path = Path(cast(str, result["candidateArtifactPath"]))
    replay_summary_path = publish_candidate_path.parent / "replay_lift_summary.json"
    replay_summary = json.loads(replay_summary_path.read_text(encoding="utf-8"))
    manifest = json.loads(Path(cast(str, result["artifact_manifest_path"])).read_text(encoding="utf-8"))
    publish_candidate = json.loads(publish_candidate_path.read_text(encoding="utf-8"))
    assert manifest["payload"]["replayReportPath"] == "replay_lift_summary.json"
    assert replay_summary["available"] is True
    assert replay_summary["qualityDegraded"] is True
    assert "reviewRequiredRate" in replay_summary["degradedMetrics"]
    assert "sameIntentGraph.conflictPairRate" in replay_summary["degradedMetrics"]
    assert replay_summary["metricComparisons"]["duplicateLabelRate"]["improved"] is True
    assert replay_summary["metricComparisons"]["reviewTaskRecurrenceRate"]["after"] == 1.0
    assert publish_candidate["replayLiftSummary"] == replay_summary


def test_replay_lift_summary_returns_none_without_source_run(tmp_path: Path) -> None:
    manifest_path = _write_manifest(tmp_path)

    replay_summary = evaluation._replay_lift_summary(str(manifest_path), {})

    assert replay_summary is None


def test_replay_lift_summary_reports_unavailable_when_source_candidate_is_missing(tmp_path: Path) -> None:
    source_manifest_path = tmp_path / "source" / "representation" / "manifest.json"
    replay_manifest_path = tmp_path / "replay" / "draft_generation" / "manifest.json"
    source_manifest_path.parent.mkdir(parents=True)
    replay_manifest_path.parent.mkdir(parents=True)
    source_manifest_path.write_text(json.dumps({"payload": {}}), encoding="utf-8")
    replay_manifest_path.write_text(
        json.dumps({"payload": {"upstream_manifest_path": str(source_manifest_path)}}),
        encoding="utf-8",
    )

    replay_summary = evaluation._replay_lift_summary(str(replay_manifest_path), {})

    assert replay_summary == {
        "schemaVersion": "feedback-replay-lift.v1",
        "available": False,
        "sourceManifestPath": str(source_manifest_path),
        "reason": "source_candidate_not_found",
        "metricComparisons": {},
        "qualityDegraded": False,
    }


def test_replay_lift_summary_uses_nested_same_intent_conflict_metric(tmp_path: Path) -> None:
    source_candidate = _candidate_with_metrics(
        {
            "reviewRequiredRate": 0.5,
            "highConfidenceWorkflowCount": 1,
            "duplicateLabelRate": 0.3,
            "entrypointSemanticSeparationMargin": 0.2,
            "positiveMarginRate": 0.4,
            "sameIntentGraph": {"conflictPairRate": 0.2},
        }
    )
    after_candidate = _candidate_with_metrics(
        {
            "reviewRequiredRate": 0.4,
            "highConfidenceWorkflowCount": 2,
            "duplicateLabelRate": 0.2,
            "entrypointSemanticSeparationMargin": 0.3,
            "positiveMarginRate": 0.5,
            "sameIntentGraph": {"conflictPairRate": 0.1},
        }
    )
    source_manifest_path = tmp_path / "source" / "representation" / "manifest.json"
    replay_manifest_path = tmp_path / "replay" / "draft_generation" / "manifest.json"
    source_candidate_path = tmp_path / "source" / "draft_generation" / "candidate.json"
    for path in (source_manifest_path, replay_manifest_path, source_candidate_path):
        path.parent.mkdir(parents=True, exist_ok=True)
    source_manifest_path.write_text(json.dumps({"payload": {}}), encoding="utf-8")
    replay_manifest_path.write_text(
        json.dumps({"payload": {"upstream_manifest_path": str(source_manifest_path)}}),
        encoding="utf-8",
    )
    source_candidate_path.write_text(json.dumps(source_candidate), encoding="utf-8")

    replay_summary = evaluation._replay_lift_summary(str(replay_manifest_path), after_candidate)

    assert replay_summary is not None
    assert replay_summary["qualityDegraded"] is False
    assert replay_summary["degradedMetrics"] == []
    assert replay_summary["metricComparisons"]["sameIntentGraph.conflictPairRate"]["before"] == 0.2
    assert replay_summary["metricComparisons"]["sameIntentGraph.conflictPairRate"]["after"] == 0.1
    assert replay_summary["metricComparisons"]["sameIntentGraph.conflictPairRate"]["improved"] is True
    assert replay_summary["metricComparisons"]["reviewTaskRecurrenceRate"]["improved"] is True


def test_load_candidate_rejects_invalid_upstream_manifest(tmp_path: Path) -> None:
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text("{not-json", encoding="utf-8")

    with pytest.raises(PipelineStageError, match="Invalid upstream manifest JSON"):
        evaluation._load_or_create_candidate(str(manifest_path))


def test_load_candidate_rejects_missing_upstream_manifest(tmp_path: Path) -> None:
    manifest_path = tmp_path / "missing-manifest.json"

    with pytest.raises(PipelineStageError, match="Failed to read upstream manifest"):
        evaluation._load_or_create_candidate(str(manifest_path))


def test_load_candidate_requires_upstream_manifest_object(tmp_path: Path) -> None:
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text("[]", encoding="utf-8")

    with pytest.raises(PipelineStageError, match="Upstream manifest must be a JSON object"):
        evaluation._load_or_create_candidate(str(manifest_path))


def test_load_candidate_rejects_missing_candidate_artifact(tmp_path: Path) -> None:
    manifest_path = _write_manifest(tmp_path, {"candidate_artifact_path": "missing-candidate.json"})

    with pytest.raises(PipelineStageError, match="Failed to read candidate artifact"):
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
