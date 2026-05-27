from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest

from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
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


def test_build_development_candidate_graph_json_has_direction_and_labels() -> None:
    candidate = evaluation._build_development_candidate()
    workflows = candidate["workflowDraft"]["workflows"]
    assert len(workflows) >= 1
    graph = json.loads(workflows[0]["graphJson"])
    assert graph["direction"] == "LR"
    for node in graph["nodes"]:
        assert "label" in node, f"node missing label: {node}"


def test_evaluation_blocks_workflow_without_terminal_node(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    candidate_path = tmp_path / "candidate.json"
    candidate_path.write_text(
        json.dumps(
            {
                "schemaVersion": "domain-pack-draft.v2",
                "domainPackDraft": {"packKey": "existing", "packName": "Existing"},
                "intentDraft": {"intents": []},
                "workflowDraft": {
                    "policies": [],
                    "risks": [],
                    "workflows": [
                        {
                            "workflowCode": "BROKEN",
                            "graphJson": json.dumps(
                                {
                                    "nodes": [{"id": "start", "type": "START"}],
                                    "edges": [],
                                }
                            ),
                            "evidenceJson": '[{"conversationId":"c1"}]',
                        }
                    ],
                },
            }
        ),
        encoding="utf-8",
    )
    manifest_path = _write_manifest(tmp_path, {"candidateArtifactPath": str(candidate_path)})
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

    result = run(str(manifest_path))

    publish_candidate_path = Path(cast(str, result["candidateArtifactPath"]))
    publish_candidate = json.loads(publish_candidate_path.read_text(encoding="utf-8"))
    assert publish_candidate["evaluationSummary"]["passed"] is False
    assert "graph_validity_failed" in publish_candidate["evaluationSummary"]["blockReasons"]


def test_evaluation_blocks_metric_threshold_failures() -> None:
    candidate = evaluation._build_development_candidate()
    candidate["intentDraft"]["intents"] = []
    candidate["evaluationInputs"] = {
        "outlierRate": 0.26,
        "workflowSeparability": 0.64,
    }

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["passed"] is False
    assert "mapping_rate_below_threshold" in summary["blockReasons"]
    assert "outlier_rate_above_threshold" in summary["blockReasons"]
    assert "workflow_separability_below_threshold" in summary["blockReasons"]


def test_needs_review_does_not_count_as_evidence() -> None:
    assert evaluation._has_evidence({"reviewStatus": "needs_review", "evidenceJson": "[]"}) is False


def test_evidence_coverage_excludes_needs_review_items_from_denominator() -> None:
    assert (
        evaluation._evidence_coverage(
            [
                {"evidenceJson": '[{"conversationId":"c1"}]'},
                {"reviewStatus": "needs_review", "evidenceJson": "[]"},
            ]
        )
        == 1.0
    )


@pytest.mark.parametrize(
    "graph_json",
    [
        None,
        "{not-json",
        "[]",
        json.dumps({"nodes": [], "edges": []}),
        json.dumps({"nodes": [{"id": "start", "type": "START"}, {"id": "done", "type": "TERMINAL"}], "edges": {}}),
        json.dumps(
            {
                "nodes": [{"id": "start", "type": "START"}, {"id": "done", "type": "TERMINAL"}],
                "edges": [{"from": "start", "to": "missing"}],
            }
        ),
    ],
)
def test_graph_validity_rejects_malformed_workflow_graphs(graph_json: object) -> None:
    assert evaluation._graph_validity([{"graphJson": graph_json}]) == "failed"


@pytest.mark.parametrize(
    "item",
    [
        {"evidenceJson": ""},
        {"evidenceJson": "{not-json"},
        {"evidenceJson": []},
        {"evidenceRefs": []},
    ],
)
def test_has_evidence_rejects_empty_or_invalid_evidence(item: dict[str, object]) -> None:
    assert evaluation._has_evidence(item) is False


def test_has_evidence_rejects_structured_but_empty_evidence() -> None:
    assert (
        evaluation._has_evidence(
            {
                "evidenceJson": json.dumps(
                    {
                        "sampleIntentPhrases": [],
                        "sampleSegmentTexts": [],
                        "exemplarConversationIds": [],
                    }
                )
            }
        )
        is False
    )


def test_has_evidence_accepts_structured_evidence_with_real_reference() -> None:
    assert (
        evaluation._has_evidence(
            {
                "evidenceJson": json.dumps(
                    {
                        "sampleIntentPhrases": [],
                        "sampleSegmentTexts": [],
                        "exemplarConversationIds": ["c1"],
                    }
                )
            }
        )
        is True
    )


def test_mapping_rate_requires_workflow_to_reference_known_intent() -> None:
    assert evaluation._mapping_rate([], []) == 0.0
    assert evaluation._mapping_rate([{"intentCode": "I1"}], [{"intentCode": "MISSING"}]) == 0.0
    assert evaluation._mapping_rate([{"intentCode": "I1"}], [{"intentCode": "I1"}]) == 1.0


def test_evaluation_blocks_pii_llm_schema_and_unsupported_policy_failures() -> None:
    candidate = evaluation._build_development_candidate()
    candidate["preprocessingSummary"] = {"piiRedactionFailed": True}
    candidate["llmSummary"] = {"schemaFailureCount": 1}
    candidate["workflowDraft"]["policies"] = [
        {
            "policyCode": "unsupported",
            "status": "approved",
            "evidenceJson": "[]",
        }
    ]

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["passed"] is False
    assert "pii_redaction_failed" in summary["blockReasons"]
    assert "llm_schema_validation_failed" in summary["blockReasons"]
    assert "unsupported_policy_or_risk" in summary["blockReasons"]


def test_llm_schema_validity_uses_valid_and_total_counts() -> None:
    assert evaluation._llm_schema_validity({"llmSummary": {"schemaValidCount": 19, "schemaTotalCount": 20}}) == 0.95


def test_metric_ignores_missing_summary_and_boolean_values() -> None:
    assert evaluation._metric({}, "outlierRate") is None
    assert evaluation._metric({"evaluationSummary": {"outlierRate": True}}, "outlierRate") is None


def test_draft_item_helpers_ignore_malformed_drafts() -> None:
    candidate = {
        "intentDraft": [],
        "workflowDraft": {
            "workflows": ["bad", {"workflowCode": "valid"}],
            "policies": "bad",
            "risks": [None, {"riskCode": "valid"}],
        },
    }

    assert evaluation._intent_items(candidate) == []
    assert evaluation._workflow_items(candidate) == [{"workflowCode": "valid"}]
    assert evaluation._policy_items(candidate) == []
    assert evaluation._risk_items(candidate) == [{"riskCode": "valid"}]
