from __future__ import annotations

import json

import pytest

from pipeline.stages.evaluation import main as evaluation


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
