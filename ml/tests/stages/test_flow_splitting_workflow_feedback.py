from __future__ import annotations

from typing import Literal

from pipeline.stages.flow_splitting.workflow_feedback import WorkflowFeedbackReconciler
from pipeline.stages.intent_discovery.feedback_constraints import WorkflowFeedbackConstraint


def _constraint(
    source: str,
    target: str,
    type_: Literal["same_workflow", "separate_workflow"],
) -> WorkflowFeedbackConstraint:
    return WorkflowFeedbackConstraint(source_id=source, target_id=target, type=type_)


def _cluster(cluster_id: int, members: list[str]) -> dict[str, object]:
    return {"cluster_id": cluster_id, "member_conv_ids": members}


def test_same_workflow_merges_groups() -> None:
    clusters = [_cluster(1, ["a", "b", "c", "d"])]
    reconciler = WorkflowFeedbackReconciler([_constraint("a", "c", "same_workflow")], clusters)

    groups = reconciler.reconcile(0, {"g1": ["a", "b"], "g2": ["c", "d"]})

    assert len(groups) == 1
    merged_members = sorted(next(iter(groups.values())))
    assert merged_members == ["a", "b", "c", "d"]

    report = reconciler.report([{"entryPointId": "entrypoint-0", "memberConversationIds": merged_members}])
    assert report["workflowConstraintCount"] == 1
    assert report["appliedWorkflowConstraintCount"] == 1
    assert report["workflowMergeByFeedbackCount"] == 1
    assert report["ignoredWorkflowConstraintCount"] == 0
    applied = report["workflowFeedback"]["applied"][0]
    assert applied["effect"] == "merged"
    assert applied["sourceEntryPointId"] == "entrypoint-0"
    assert applied["targetEntryPointId"] == "entrypoint-0"


def test_same_workflow_already_same_is_applied_without_merge() -> None:
    clusters = [_cluster(1, ["a", "b"])]
    reconciler = WorkflowFeedbackReconciler([_constraint("a", "b", "same_workflow")], clusters)

    groups = reconciler.reconcile(0, {"g1": ["a", "b"]})

    assert groups == {"g1": ["a", "b"]}
    report = reconciler.report([{"entryPointId": "entrypoint-0", "memberConversationIds": ["a", "b"]}])
    assert report["appliedWorkflowConstraintCount"] == 1
    assert report["workflowMergeByFeedbackCount"] == 0
    assert report["workflowFeedback"]["applied"][0]["effect"] == "already_same"


def test_separate_workflow_splits_single_group() -> None:
    clusters = [_cluster(1, ["a", "b", "c"])]
    reconciler = WorkflowFeedbackReconciler([_constraint("a", "b", "separate_workflow")], clusters)

    groups = reconciler.reconcile(0, {"g1": ["a", "b", "c"]})

    assert len(groups) == 2
    assert ["b"] in groups.values()
    report = reconciler.report(
        [
            {"entryPointId": "entrypoint-0", "memberConversationIds": ["a", "c"]},
            {"entryPointId": "entrypoint-1", "memberConversationIds": ["b"]},
        ]
    )
    assert report["workflowSplitByFeedbackCount"] == 1
    applied = report["workflowFeedback"]["applied"][0]
    assert applied["effect"] == "split"
    assert applied["sourceEntryPointId"] == "entrypoint-0"
    assert applied["targetEntryPointId"] == "entrypoint-1"


def test_separate_workflow_already_separate_is_applied_without_split() -> None:
    clusters = [_cluster(1, ["a", "b"])]
    reconciler = WorkflowFeedbackReconciler([_constraint("a", "b", "separate_workflow")], clusters)

    groups = reconciler.reconcile(0, {"g1": ["a"], "g2": ["b"]})

    assert groups == {"g1": ["a"], "g2": ["b"]}
    report = reconciler.report([])
    assert report["workflowSplitByFeedbackCount"] == 0
    assert report["workflowFeedback"]["applied"][0]["effect"] == "already_separate"


def test_conflicting_separate_after_same_is_ignored() -> None:
    clusters = [_cluster(1, ["a", "b", "c"])]
    constraints = [
        _constraint("a", "b", "same_workflow"),
        _constraint("a", "b", "separate_workflow"),
    ]
    reconciler = WorkflowFeedbackReconciler(constraints, clusters)

    reconciler.reconcile(0, {"g1": ["a"], "g2": ["b"], "g3": ["c"]})

    report = reconciler.report([])
    assert report["workflowMergeByFeedbackCount"] == 1
    assert report["ignoredWorkflowConstraintCount"] == 1
    ignored = report["workflowFeedback"]["ignored"][0]
    assert ignored["type"] == "separate_workflow"
    assert ignored["reason"] == "conflicts_with_same_workflow"


def test_endpoints_in_different_clusters_are_ignored() -> None:
    clusters = [_cluster(1, ["a", "b"]), _cluster(2, ["x", "y"])]
    reconciler = WorkflowFeedbackReconciler([_constraint("a", "x", "same_workflow")], clusters)

    reconciler.reconcile(0, {"g1": ["a", "b"]})
    reconciler.reconcile(1, {"g1": ["x", "y"]})

    report = reconciler.report([])
    assert report["appliedWorkflowConstraintCount"] == 0
    assert report["workflowFeedback"]["ignored"][0]["reason"] == "endpoints_in_different_clusters"


def test_endpoint_not_in_any_candidate_is_ignored() -> None:
    clusters = [_cluster(1, ["a", "b"])]
    reconciler = WorkflowFeedbackReconciler([_constraint("a", "missing", "same_workflow")], clusters)

    reconciler.reconcile(0, {"g1": ["a", "b"]})

    report = reconciler.report([])
    assert report["workflowFeedback"]["ignored"][0]["reason"] == "endpoint_not_in_candidate"


def test_no_constraints_is_noop() -> None:
    reconciler = WorkflowFeedbackReconciler([], [_cluster(1, ["a", "b"])])

    groups = reconciler.reconcile(0, {"g1": ["a", "b"]})

    assert groups == {"g1": ["a", "b"]}
    report = reconciler.report([])
    assert report["workflowConstraintCount"] == 0
    assert report["workflowFeedback"]["applied"] == []
    assert report["workflowFeedback"]["ignored"] == []
