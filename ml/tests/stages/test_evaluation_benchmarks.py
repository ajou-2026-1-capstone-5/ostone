from __future__ import annotations

import json
from pathlib import Path
from typing import cast

import pytest

from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.evaluation import main as evaluation
from pipeline.stages.evaluation.main import run
from tests.helpers.evaluation import (
    _candidate_with_pairwise_members,
    _write_manifest,
)


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
        "slotEvidenceCoverage": 0.79,
        "policyCoverage": 0.79,
        "riskCoverage": 0.79,
    }

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["passed"] is False
    assert "mapping_rate_below_threshold" in summary["blockReasons"]
    assert "outlier_rate_above_threshold" in summary["blockReasons"]
    assert "workflow_separability_below_threshold" in summary["blockReasons"]
    assert "slot_evidence_coverage_below_threshold" in summary["blockReasons"]
    assert "policy_coverage_below_threshold" in summary["blockReasons"]
    assert "risk_coverage_below_threshold" in summary["blockReasons"]
    assert summary["slotEvidenceCoverage"] == 0.79
    assert summary["policyCoverage"] == 0.79
    assert summary["riskCoverage"] == 0.79


def test_evaluation_blocks_missing_strict_metrics() -> None:
    candidate = evaluation._build_development_candidate()
    candidate["evaluationInputs"] = {"outlierRate": 0.0}

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["passed"] is False
    assert "missing_metric:workflowSeparability" in summary["blockReasons"]
    assert "missing_metric:semanticQualityFinal" in summary["blockReasons"]


def test_pairwise_benchmark_scores_must_link_and_cannot_link_without_category_labels() -> None:
    candidate = _candidate_with_pairwise_members()

    summary = evaluation._evaluate_candidate(
        candidate,
        benchmark=[
            {"sourceId": "caselet-a1", "targetId": "caselet-a2", "relation": "must_link"},
            {"sourceId": "caselet-a1", "targetId": "caselet-b1", "relation": "cannot_link"},
        ],
    )

    assert summary["passed"] is True
    assert summary["pairwiseBenchmark"]["enabled"] is True
    assert summary["benchmarkPairCount"] == 2
    assert summary["benchmarkCoverage"] == 1.0
    assert summary["benchmarkMustLinkRecall"] == 1.0
    assert summary["benchmarkCannotLinkViolationRate"] == 0.0


def test_benchmark_suite_intent_pairs_are_mapped_without_category_labels() -> None:
    parsed = evaluation._parse_pairwise_benchmark(
        {
            "schemaVersion": "evaluation-benchmark-suite.v1",
            "intentPairs": [
                {
                    "sourceCaseletId": "caselet-a1",
                    "targetCaseletId": "caselet-a2",
                    "relation": "same_intent",
                },
                {
                    "sourceCaseletId": "caselet-a1",
                    "targetCaseletId": "caselet-b1",
                    "relation": "different_intent_same_object",
                },
                {
                    "sourceCaseletId": "caselet-b1",
                    "targetCaseletId": "caselet-c1",
                    "relation": "same_workflow_pattern_different_intent",
                },
            ],
            "boundaryCases": [],
            "labelExpectations": [
                {
                    "clusterGoldId": "G001",
                    "object": "요금",
                    "action": "확인",
                    "allowedLabels": ["요금 확인 문의"],
                }
            ],
            "workflowExpectations": [],
        }
    )

    assert [pair["relation"] for pair in parsed] == ["must_link", "cannot_link", "cannot_link"]


def test_benchmark_suite_scores_boundary_label_and_workflow_without_category_labels() -> None:
    candidate = _candidate_with_pairwise_members()
    candidate["intentDraft"]["intents"][0]["name"] = "요금 확인 문의"
    candidate["intentDraft"]["intents"][0]["sourceClusterRef"] = json.dumps(
        {
            "segmentIds": ["caselet-a1", "caselet-a2"],
            "segments": [
                {
                    "caseletId": "caselet-a1",
                    "sourceConversationId": "conv-a",
                    "turnStart": 0,
                    "turnEnd": 1,
                    "flowEvents": ["확인질문"],
                }
            ],
        }
    )
    candidate["intentDraft"]["intents"][0]["representativeCases"] = [
        {
            "conversationId": "caselet-a1",
            "caseletId": "caselet-a1",
            "sourceConversationId": "conv-a",
            "turnStart": 0,
            "turnEnd": 1,
            "canonicalText": "요금 확인 문의",
            "customerProblemText": "요금 확인",
            "endedStatus": "resolved",
            "flowEvents": ["확인질문"],
        }
    ]
    candidate["workflowDraft"]["workflows"][0]["graphJson"] = json.dumps(
        {
            "direction": "LR",
            "nodes": [
                {"id": "start", "type": "START", "label": "시작"},
                {
                    "id": "request_check",
                    "type": "ACTION",
                    "label": "요금 확인",
                    "evidenceRefs": [{"type": "flow_event", "value": "확인질문"}],
                },
                {"id": "terminal", "type": "TERMINAL", "label": "종료"},
            ],
            "edges": [
                {"id": "e1", "from": "start", "to": "request_check"},
                {"id": "e2", "from": "request_check", "to": "terminal"},
            ],
        }
    )
    candidate["workflowDraft"]["workflows"][0]["routeConditionJson"] = json.dumps({"requiredTerms": ["요금"]})

    summary = evaluation._evaluate_candidate(
        candidate,
        benchmark={
            "schemaVersion": "evaluation-benchmark-suite.v1",
            "intentPairs": [
                {"sourceCaseletId": "caselet-a1", "targetCaseletId": "caselet-a2", "relation": "same_intent"}
            ],
            "boundaryCases": [
                {
                    "conversationId": "conv-a",
                    "expectedCaselets": [{"turnStart": 0, "turnEnd": 1, "issueObject": "요금", "issueAction": "확인"}],
                }
            ],
            "labelExpectations": [
                {
                    "clusterGoldId": "G001",
                    "memberCaseletIds": ["caselet-a1"],
                    "object": "요금",
                    "action": "확인",
                    "allowedLabels": ["요금 확인 문의"],
                    "forbiddenTerms": ["수고했습니다"],
                }
            ],
            "workflowExpectations": [
                {
                    "caseletId": "caselet-a1",
                    "expectedEvents": ["확인질문"],
                    "expectedBranchConditions": ["요금"],
                }
            ],
        },
    )

    assert summary["benchmarkSuite"]["enabled"] is True
    assert summary["benchmarkPairCount"] == 1
    assert summary["benchmarkBoundaryCaseCount"] == 1
    assert summary["benchmarkBoundaryRecall"] == 1.0
    assert summary["benchmarkLabelExpectationCount"] == 1
    assert summary["benchmarkLabelObjectActionJointAccuracy"] == 1.0
    assert summary["benchmarkWorkflowExpectationCount"] == 1
    assert summary["benchmarkWorkflowEventRecall"] == 1.0
    assert "benchmark_label_forbidden_term_violation" not in summary["blockReasons"]


def test_benchmark_suite_blocks_forbidden_label_terms_without_category_gold() -> None:
    candidate = _candidate_with_pairwise_members()
    candidate["intentDraft"]["intents"][0]["name"] = "수고했습니다 요금 확인 문의"

    summary = evaluation._evaluate_candidate(
        candidate,
        benchmark={
            "schemaVersion": "evaluation-benchmark-suite.v1",
            "labelExpectations": [
                {
                    "clusterGoldId": "G001",
                    "memberCaseletIds": ["caselet-a1"],
                    "object": "요금",
                    "action": "확인",
                    "forbiddenTerms": ["수고했습니다"],
                }
            ],
        },
    )

    assert summary["passed"] is False
    assert summary["labelBenchmark"]["forbiddenTermViolationRate"] == 1.0
    assert "benchmark_label_forbidden_term_violation" in summary["blockReasons"]


def test_pairwise_benchmark_blocks_cannot_link_overmerge() -> None:
    candidate = _candidate_with_pairwise_members()

    summary = evaluation._evaluate_candidate(
        candidate,
        benchmark=[{"sourceId": "caselet-a1", "targetId": "caselet-a2", "relation": "cannot_link"}],
    )

    assert summary["passed"] is False
    assert "benchmark_cannot_link_violation" in summary["blockReasons"]
    assert summary["benchmarkCannotLinkViolationRate"] == 1.0


def test_workflow_benchmark_matches_event_aliases_to_graph_control_nodes() -> None:
    candidate = _candidate_with_pairwise_members()
    candidate["workflowDraft"]["workflows"][0]["graphJson"] = json.dumps(
        {
            "nodes": [
                {"id": "start", "type": "START", "label": "시작"},
                {"id": "policy_control", "type": "ACTION", "label": "정책 확인: 요청 조건 확인"},
                {"id": "terminal", "type": "TERMINAL", "label": "종료"},
            ],
            "edges": [],
        },
        ensure_ascii=False,
    )

    summary = evaluation._evaluate_candidate(
        candidate,
        benchmark={
            "schemaVersion": "evaluation-benchmark-suite.v1",
            "workflowExpectations": [
                {
                    "caseletId": "caselet-a1",
                    "expectedEvents": ["정책안내", "해결"],
                }
            ],
        },
    )

    assert summary["benchmarkWorkflowEventRecall"] == 1.0


def test_pairwise_benchmark_rejects_unavailable_category_gold() -> None:
    with pytest.raises(PipelineStageError, match="must not contain unavailable metadata"):
        evaluation._parse_pairwise_benchmark(
            {
                "pairs": [
                    {
                        "sourceCaseletId": "caselet-a1",
                        "targetCaseletId": "caselet-a2",
                        "relation": "must_link",
                        "consulting_category": "test-only label",
                    }
                ]
            }
        )


def test_evaluation_loads_pairwise_benchmark_from_manifest_payload(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    candidate_path = tmp_path / "candidate.json"
    candidate_path.write_text(json.dumps(_candidate_with_pairwise_members()), encoding="utf-8")
    benchmark_path = tmp_path / "benchmark.json"
    benchmark_path.write_text(
        json.dumps(
            {
                "schemaVersion": "evaluation-pairwise-benchmark.v1",
                "pairs": [
                    {
                        "sourceCaseletId": "caselet-a1",
                        "targetCaseletId": "caselet-a2",
                        "relation": "cannot_link",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    manifest_path = _write_manifest(
        tmp_path,
        {
            "candidateArtifactPath": str(candidate_path),
            "evaluationBenchmarkPath": str(benchmark_path),
        },
    )
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

    result = run(str(manifest_path))

    summary = result["evaluation_summary"]
    assert isinstance(summary, dict)
    assert summary["pairwiseBenchmark"]["enabled"] is True
    assert summary["passed"] is False
    assert "benchmark_cannot_link_violation" in summary["blockReasons"]


@pytest.mark.parametrize(
    "benchmark_path",
    sorted((Path(__file__).parents[2] / "benchmarks").glob("validation-*.sample.json")),
)
def test_category_free_benchmark_samples_are_parseable(benchmark_path: Path) -> None:
    payload = json.loads(benchmark_path.read_text(encoding="utf-8"))

    benchmark = evaluation._parse_benchmark_suite(payload, benchmark_path)

    assert benchmark["schemaVersion"] == "evaluation-benchmark-suite.v1"
    assert benchmark["intentPairs"] or benchmark["boundaryCases"]
    assert benchmark["labelExpectations"]
    assert benchmark["workflowExpectations"]
