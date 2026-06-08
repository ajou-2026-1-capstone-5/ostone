from __future__ import annotations

import pytest

from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.draft_generation.main import (
    _build_candidate,
    _build_workflow_draft,
    _derive_pack_identity,
    _evaluation_inputs,
    _label_metrics,
)
from tests.helpers.draft_generation import _stage_context


def test_build_candidate_structure() -> None:
    intents = [{"intentCode": "INTENT_0", "name": "환불", "representativeCases": []}]
    clusters = [{"cluster_id": 0, "suggested_name": "환불", "workflow_signal": {}}]
    context = _stage_context(workspace_id="ws1", dataset_id="ds1")
    workflow_draft, _ = _build_workflow_draft(clusters)

    candidate = _build_candidate(intents, workflow_draft, context)

    assert candidate["schemaVersion"] == "1.0"
    assert candidate["intentDraft"]["intents"] == intents
    assert candidate["domainPackDraft"]["packKey"] == "pack_wsws1_dsds1"
    assert candidate["domainPackDraft"]["packName"] == "Pack wsws1/dsds1"
    wf_draft = candidate["workflowDraft"]
    assert len(wf_draft["workflows"]) == 1
    assert wf_draft["workflows"][0]["workflowCode"] == "WORKFLOW_0"
    assert wf_draft["workflows"][0]["intentCode"] == "INTENT_0"
    assert len(wf_draft["policies"]) == 1
    assert wf_draft["policies"][0]["policyCode"] == "default_policy"


def test_evaluation_inputs_collects_source_quality_metrics() -> None:
    evaluation_inputs = _evaluation_inputs(
        {
            "stats": {"outlier_rate": 0.2},
            "flow_split_metrics": {"workflowSeparability": 0.75},
        },
        {"intent_count": 2},
        {"workflow_count": 2},
        {"cluster_with_slot_count": 1},
    )

    assert evaluation_inputs == {
        "mappingRate": 1.0,
        "outlierRate": 0.2,
        "workflowSeparability": 0.75,
        "slotCoverage": 0.5,
    }


def test_evaluation_inputs_prefers_unrepresented_outlier_rate() -> None:
    evaluation_inputs = _evaluation_inputs(
        {
            "stats": {"outlier_rate": 0.6},
            "flow_split_metrics": {
                "workflowSeparability": 1.0,
                "unrepresentedOutlierRate": 0.0,
                "representedOutlierCoverage": 1.0,
                "promotedNovelCandidateCount": 1,
                "promotedNovelMemberCount": 3,
                "unrepresentedOutlierMemberCount": 0,
            },
        },
        {"intent_count": 1},
        {"workflow_count": 1},
        {"cluster_with_slot_count": 1},
    )

    assert evaluation_inputs["outlierRate"] == 0.0
    assert evaluation_inputs["rawOutlierRate"] == 0.6
    assert evaluation_inputs["representedOutlierCoverage"] == 1.0
    assert evaluation_inputs["promotedNovelCandidateCount"] == 1


def test_evaluation_inputs_maps_workflows_against_leaf_intents() -> None:
    evaluation_inputs = _evaluation_inputs(
        {
            "stats": {"outlier_rate": 0.0},
            "flow_split_metrics": {"workflowSeparability": 0.9},
        },
        {
            "intent_count": 3,
            "parent_intent_count": 1,
            "leaf_intent_count": 2,
            "workflow_variant_intent_count": 2,
            "variants_per_parent_intent_avg": 2.0,
            "variants_per_parent_intent_max": 2,
            "single_variant_intent_rate": 0.0,
        },
        {"workflow_count": 2},
        {"cluster_with_slot_count": 1},
    )

    assert evaluation_inputs["mappingRate"] == 1.0
    assert evaluation_inputs["slotCoverage"] == 0.5
    assert evaluation_inputs["parentIntentCount"] == 1.0
    assert evaluation_inputs["leafIntentCount"] == 2.0
    assert evaluation_inputs["workflowVariantIntentCount"] == 2.0
    assert evaluation_inputs["variantsPerParentIntentAvg"] == 2.0
    assert evaluation_inputs["variantsPerParentIntentMax"] == 2.0
    assert evaluation_inputs["singleVariantIntentRate"] == 0.0


def test_evaluation_inputs_collects_label_and_workflow_path_metrics() -> None:
    evaluation_inputs = _evaluation_inputs(
        {
            "stats": {"outlier_rate": 0.0},
            "flow_split_metrics": {"workflowSeparability": 1.0},
            "clusters": [
                {
                    "label_score": 0.8,
                    "label_evidence_coverage": 0.75,
                    "label_member_evidence_coverage": 0.5,
                    "label_object_action_joint_coverage": 0.7,
                    "label_validation_status": "auto_acceptable",
                },
                {
                    "label_score": 0.6,
                    "label_evidence_coverage": 0.5,
                    "label_member_evidence_coverage": 0.25,
                    "label_object_action_joint_coverage": 0.2,
                    "label_validation_status": "needs_review",
                },
            ],
        },
        {"intent_count": 2},
        {"workflow_count": 2, "workflow_path_support": 0.7, "workflow_replay_fitness": 0.65},
        {"cluster_with_slot_count": 2},
    )

    assert evaluation_inputs["labelFidelity"] == pytest.approx(0.7)
    assert evaluation_inputs["labelEvidenceCoverage"] == pytest.approx(0.625)
    assert evaluation_inputs["labelMemberEvidenceCoverage"] == pytest.approx(0.375)
    assert evaluation_inputs["labelObjectActionJointCoverage"] == pytest.approx(0.45)
    assert evaluation_inputs["labelNeedsReviewRate"] == pytest.approx(0.5)
    assert evaluation_inputs["autoCandidateLabelCount"] == 1.0
    assert evaluation_inputs["autoCandidateLabelMemberEvidenceCoverage"] == 0.5
    assert evaluation_inputs["autoCandidateLabelObjectActionJointCoverage"] == 0.7
    assert evaluation_inputs["reviewRequiredLabelCount"] == 1.0
    assert evaluation_inputs["reviewRequiredLabelMemberEvidenceCoverage"] == 0.25
    assert evaluation_inputs["workflowPathSupport"] == 0.7
    assert evaluation_inputs["workflowReplayFitness"] == 0.65


def test_label_metrics_separate_review_only_novel_candidates() -> None:
    metrics = _label_metrics(
        [
            {
                "label_score": 0.8,
                "label_evidence_coverage": 0.75,
                "label_member_evidence_coverage": 0.5,
                "label_object_action_joint_coverage": 0.6,
                "label_validation_status": "auto_acceptable",
            },
            {
                "label_score": 0.2,
                "label_evidence_coverage": 0.0,
                "label_member_evidence_coverage": 0.0,
                "label_object_action_joint_coverage": 0.0,
                "label_validation_status": "needs_review",
                "is_novel_outlier_candidate": True,
            },
        ]
    )

    assert metrics["labelFidelity"] == 0.8
    assert metrics["labelMemberEvidenceCoverage"] == 0.5
    assert metrics["labelObjectActionJointCoverage"] == 0.6
    assert metrics["labelNeedsReviewRate"] == 0.0
    assert metrics["autoCandidateLabelCount"] == 1.0
    assert metrics["autoCandidateLabelObjectActionJointCoverage"] == 0.6
    assert metrics["reviewCandidateLabelFidelity"] == 0.2


def test_build_candidate_raises_when_workspace_id_missing() -> None:
    context = _stage_context(workspace_id=None, dataset_id="ds1")
    with pytest.raises(PipelineStageError, match="packKey requires both"):
        _build_candidate([], {}, context)


def test_build_candidate_raises_when_dataset_id_missing() -> None:
    context = _stage_context(workspace_id="ws1", dataset_id=None)
    with pytest.raises(PipelineStageError, match="packKey requires both"):
        _build_candidate([], {}, context)


def test_derive_pack_identity_formats_correctly() -> None:
    context = _stage_context(workspace_id="ws42", dataset_id="ds7")
    pack_key, pack_name = _derive_pack_identity(context)
    assert pack_key == "pack_wsws42_dsds7"
    assert pack_name == "Pack wsws42/dsds7"


def test_derive_pack_identity_raises_on_none_workspace() -> None:
    context = _stage_context(workspace_id=None, dataset_id="ds1")
    with pytest.raises(PipelineStageError, match="packKey requires both workspace_id and dataset_id"):
        _derive_pack_identity(context)


def test_derive_pack_identity_raises_on_none_dataset() -> None:
    context = _stage_context(workspace_id="ws1", dataset_id=None)
    with pytest.raises(PipelineStageError, match="packKey requires both workspace_id and dataset_id"):
        _derive_pack_identity(context)
