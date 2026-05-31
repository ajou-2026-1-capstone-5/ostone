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


def test_evaluation_routes_weak_member_replay_and_overmerge_metrics_to_review() -> None:
    candidate = evaluation._build_development_candidate()
    candidate["evaluationInputs"].update(
        {
            "labelMemberEvidenceCoverage": 0.55,
            "workflowReplayFitness": 0.62,
            "sameIntentOvermergeRisk": 0.25,
        }
    )

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["passed"] is True
    assert summary["releaseTier"] == "REVIEW_REQUIRED"
    assert "label_member_evidence_coverage_below_threshold" in summary["qualityReviewReasons"]
    assert "workflow_replay_fitness_below_threshold" in summary["qualityReviewReasons"]
    assert "same_intent_overmerge_risk_above_threshold" in summary["qualityReviewReasons"]


def test_evaluation_blocks_severe_member_replay_and_overmerge_failures() -> None:
    candidate = evaluation._build_development_candidate()
    candidate["evaluationInputs"].update(
        {
            "labelMemberEvidenceCoverage": 0.20,
            "workflowReplayFitness": 0.20,
            "sameIntentOvermergeRisk": 0.60,
        }
    )

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["passed"] is False
    assert "label_member_evidence_coverage_below_block_threshold" in summary["blockReasons"]
    assert "workflow_replay_fitness_below_block_threshold" in summary["blockReasons"]
    assert "same_intent_overmerge_risk_above_block_threshold" in summary["blockReasons"]


def test_evaluation_routes_low_review_only_label_quality_to_review_when_auto_labels_are_grounded() -> None:
    candidate = evaluation._build_development_candidate()
    candidate["evaluationInputs"].update(
        {
            "labelMemberEvidenceCoverage": 0.32,
            "labelObjectActionJointCoverage": 0.30,
            "autoCandidateLabelCount": 4.0,
            "autoCandidateLabelMemberEvidenceCoverage": 0.72,
            "autoCandidateLabelObjectActionJointCoverage": 0.70,
        }
    )

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["passed"] is True
    assert summary["releaseTier"] == "REVIEW_REQUIRED"
    assert "label_member_evidence_coverage_below_block_threshold" not in summary["blockReasons"]
    assert "label_object_action_joint_coverage_below_block_threshold" not in summary["blockReasons"]
    assert "review_required_label_member_evidence_coverage_below_block_threshold" in summary["qualityReviewReasons"]
    assert "review_required_label_object_action_joint_coverage_below_block_threshold" in summary["qualityReviewReasons"]
    assert summary["autoCandidateLabelObjectActionJointCoverage"] == 0.70


def test_evaluation_blocks_low_label_quality_when_auto_labels_are_also_weak() -> None:
    candidate = evaluation._build_development_candidate()
    candidate["evaluationInputs"].update(
        {
            "labelMemberEvidenceCoverage": 0.32,
            "labelObjectActionJointCoverage": 0.30,
            "autoCandidateLabelCount": 4.0,
            "autoCandidateLabelMemberEvidenceCoverage": 0.30,
            "autoCandidateLabelObjectActionJointCoverage": 0.20,
        }
    )

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["passed"] is False
    assert "auto_candidate_label_member_evidence_coverage_below_block_threshold" in summary["blockReasons"]
    assert "auto_candidate_label_object_action_joint_coverage_below_block_threshold" in summary["blockReasons"]


def test_evaluation_reports_field_level_evidence_sufficiency() -> None:
    candidate = evaluation._build_development_candidate()

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["evidenceSufficiency"] == 1.0
    assert summary["evidenceSufficiencySupportedFieldCount"] == summary["evidenceSufficiencyTotalFieldCount"]
    assert summary["evidenceSufficiencyTotalFieldCount"] > 0
    assert summary["evidenceSufficiencyUnsupportedFields"] == []


def test_evaluation_blocks_evidence_sufficiency_failures() -> None:
    candidate = evaluation._build_development_candidate()
    candidate["intentDraft"]["intents"][0]["evidenceJson"] = "[]"
    candidate["workflowDraft"]["workflows"][0]["evidenceJson"] = "[]"
    candidate["workflowDraft"]["policies"][0]["evidenceJson"] = "[]"

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["passed"] is False
    assert summary["evidenceSufficiency"] < 0.80
    assert "evidence_sufficiency_below_threshold" in summary["blockReasons"]
    assert summary["evidenceSufficiencyUnsupportedFields"]


def test_evidence_sufficiency_requires_enrichment_used_evidence_ids() -> None:
    candidate = evaluation._build_development_candidate()
    candidate["intentDraft"]["intents"][0]["nameEnrichmentJson"] = json.dumps({"usedEvidenceIds": []})

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["evidenceSufficiency"] < 1.0
    assert {
        "entityType": "intent",
        "entityCode": "general_inquiry",
        "field": "name",
    } in summary["evidenceSufficiencyUnsupportedFields"]


def test_evaluation_blocks_structure_only_semantic_quality() -> None:
    candidate = evaluation._build_development_candidate()
    candidate["evaluationInputs"] = {
        "semanticQualityFinal": False,
        "semanticClusterCohesion": 0.91,
        "semanticSeparationMargin": 0.12,
        "semanticSilhouetteProxy": 0.56,
    }

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["passed"] is False
    assert "semantic_quality_not_final" in summary["blockReasons"]
    assert summary["semanticQualityFinal"] is False
    assert summary["semanticClusterCohesion"] == 0.91


def test_evaluation_routes_soft_quality_failures_to_review_required() -> None:
    candidate = evaluation._build_development_candidate()
    candidate["evaluationInputs"].update(
        {
            "clusterStability": 0.4,
            "clusterDistinctiveness": 0.15,
            "labelFidelity": 0.4,
            "entrypointSemanticCoverage": 1.0,
            "entrypointDistinctiveness": 0.62,
        }
    )

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["passed"] is True
    assert summary["releaseTier"] == "REVIEW_REQUIRED"
    assert summary["blockReasons"] == []
    assert "cluster_stability_below_threshold" in summary["qualityReviewReasons"]
    assert "cluster_distinctiveness_below_threshold" in summary["qualityReviewReasons"]
    assert "label_fidelity_below_threshold" in summary["qualityReviewReasons"]
    assert summary["entrypointSemanticCoverage"] == 1.0
    assert summary["entrypointDistinctiveness"] == 0.62


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


def test_graph_validity_reports_semantic_graph_errors() -> None:
    graph_json = json.dumps(
        {
            "nodes": [
                {"id": "start", "type": "START"},
                {"id": "action", "type": "ACTION"},
                {"id": "orphan", "type": "ACTION"},
                {"id": "done", "type": "TERMINAL"},
            ],
            "edges": [{"id": "e1", "from": "start", "to": "action"}],
        }
    )

    errors = evaluation._graph_validation_errors([{"graphJson": graph_json}])

    assert "terminal_unreachable" in errors
    assert "unreachable_node" in errors
    assert "dead_non_terminal_node" in errors


def test_release_tier_distinguishes_auto_review_and_rejected() -> None:
    auto = evaluation._release_tier(
        block_reasons=[],
        cluster_stability=0.80,
        label_fidelity=0.80,
        workflow_path_support=0.80,
        quality_review_reasons=[],
        review_required_rate=0.05,
        duplicate_label_rate=0.0,
        workflow_confidence_avg=0.85,
        workflow_confidence_min=0.70,
    )
    review = evaluation._release_tier(
        block_reasons=[],
        cluster_stability=0.80,
        label_fidelity=0.80,
        workflow_path_support=0.80,
        quality_review_reasons=[],
        review_required_rate=0.50,
        duplicate_label_rate=0.0,
        workflow_confidence_avg=0.85,
        workflow_confidence_min=0.70,
    )
    rejected = evaluation._release_tier(
        block_reasons=["graph_validity_failed"],
        cluster_stability=1.0,
        label_fidelity=1.0,
        workflow_path_support=1.0,
        quality_review_reasons=[],
        review_required_rate=0.0,
        duplicate_label_rate=0.0,
        workflow_confidence_avg=1.0,
        workflow_confidence_min=1.0,
    )

    assert auto == "AUTO_CANDIDATE"
    assert review == "REVIEW_REQUIRED"
    assert rejected == "REJECTED"


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


def test_evaluation_summary_includes_parent_variant_metrics() -> None:
    candidate = evaluation._build_development_candidate()
    candidate["evaluationInputs"].update(
        {
            "parentIntentCount": 2.0,
            "leafIntentCount": 7.0,
            "workflowVariantIntentCount": 5.0,
            "variantsPerParentIntentAvg": 2.5,
            "variantsPerParentIntentMax": 3.0,
            "singleVariantIntentRate": 0.4,
        }
    )

    summary = evaluation._evaluate_candidate(candidate)

    assert summary["parentIntentCount"] == 2.0
    assert summary["leafIntentCount"] == 7.0
    assert summary["workflowVariantIntentCount"] == 5.0
    assert summary["variantsPerParentIntentAvg"] == 2.5
    assert summary["variantsPerParentIntentMax"] == 3.0
    assert summary["singleVariantIntentRate"] == 0.4


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
    assert evaluation._slot_items(candidate) == []


def _candidate_with_pairwise_members() -> dict[str, Any]:
    candidate = evaluation._build_development_candidate()
    graph_json = candidate["workflowDraft"]["workflows"][0]["graphJson"]
    candidate["intentDraft"]["intents"] = [
        {
            "intentCode": "INTENT_A",
            "name": "Intent A",
            "description": "Intent A",
            "taxonomyLevel": 1,
            "parentIntentCode": None,
            "sourceClusterRef": json.dumps({"segmentIds": ["caselet-a1", "caselet-a2"]}),
            "entryConditionJson": "{}",
            "evidenceJson": json.dumps({"exemplarConversationIds": ["caselet-a1"]}),
            "metaJson": "{}",
            "representativeCases": [{"conversationId": "caselet-a2"}],
        },
        {
            "intentCode": "INTENT_B",
            "name": "Intent B",
            "description": "Intent B",
            "taxonomyLevel": 1,
            "parentIntentCode": None,
            "sourceClusterRef": json.dumps({"segmentIds": ["caselet-b1"]}),
            "entryConditionJson": "{}",
            "evidenceJson": json.dumps({"exemplarConversationIds": ["caselet-b1"]}),
            "metaJson": "{}",
            "representativeCases": [],
        },
    ]
    candidate["workflowDraft"]["workflows"] = [
        {
            "workflowCode": "WORKFLOW_A",
            "name": "Workflow A",
            "description": "Workflow A",
            "graphJson": graph_json,
            "evidenceJson": json.dumps(
                [
                    {"type": "member_conv_id", "value": "caselet-a1"},
                    {"type": "member_conv_id", "value": "caselet-a2"},
                ]
            ),
            "metaJson": "{}",
            "intentCode": "INTENT_A",
            "isPrimary": True,
            "routeConditionJson": "{}",
        },
        {
            "workflowCode": "WORKFLOW_B",
            "name": "Workflow B",
            "description": "Workflow B",
            "graphJson": graph_json,
            "evidenceJson": json.dumps([{"type": "member_conv_id", "value": "caselet-b1"}]),
            "metaJson": "{}",
            "intentCode": "INTENT_B",
            "isPrimary": True,
            "routeConditionJson": "{}",
        },
    ]
    return candidate
