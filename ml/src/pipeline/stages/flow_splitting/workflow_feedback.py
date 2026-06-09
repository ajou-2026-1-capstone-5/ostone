from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from pipeline.stages.intent_discovery.feedback_constraints import WorkflowFeedbackConstraint

from .helpers import _string_list

SEPARATE_GROUP_PREFIX = "workflow_feedback_separate"

REASON_DIFFERENT_CLUSTERS = "endpoints_in_different_clusters"
REASON_NOT_IN_CANDIDATE = "endpoint_not_in_candidate"
REASON_CONFLICT = "conflicts_with_same_workflow"

EFFECT_MERGED = "merged"
EFFECT_ALREADY_SAME = "already_same"
EFFECT_SPLIT = "split"
EFFECT_ALREADY_SEPARATE = "already_separate"


@dataclass
class _Outcome:
    constraint: WorkflowFeedbackConstraint
    applied: bool
    effect: str
    reason: str
    source_cluster_id: Any = None


class _UnionFind:
    def __init__(self, items: list[Any]) -> None:
        self._parent: dict[Any, Any] = {item: item for item in items}

    def find(self, item: Any) -> Any:
        root = item
        while self._parent[root] != root:
            root = self._parent[root]
        while self._parent[item] != root:
            self._parent[item], item = root, self._parent[item]
        return root

    def union(self, left: Any, right: Any) -> None:
        self._parent[self.find(right)] = self.find(left)


class WorkflowFeedbackReconciler:
    """flow group을 workflow-scope feedback constraint에 맞게 merge/split한다.

    workflow entrypoint = source cluster 내 flow group이므로, 두 endpoint가 같은
    candidate cluster에 속할 때만 적용한다. 적용 불가 constraint는 reason과 함께
    무시 내역으로 남긴다.
    """

    def __init__(
        self,
        constraints: list[WorkflowFeedbackConstraint],
        candidate_clusters: list[dict[str, Any]],
    ) -> None:
        self._constraint_count = len(constraints)
        self._outcomes: list[_Outcome] = []
        self._by_cluster: dict[int, list[WorkflowFeedbackConstraint]] = defaultdict(list)
        member_to_cluster: dict[str, int] = {}
        source_id_by_index: dict[int, Any] = {}
        for index, cluster in enumerate(candidate_clusters):
            if not isinstance(cluster, dict):
                continue
            source_id_by_index[index] = cluster.get("cluster_id")
            for member in _string_list(cluster.get("member_conv_ids")):
                member_to_cluster.setdefault(member, index)
        self._source_id_by_index = source_id_by_index
        for constraint in constraints:
            self._classify(constraint, member_to_cluster)

    def _classify(self, constraint: WorkflowFeedbackConstraint, member_to_cluster: dict[str, int]) -> None:
        source_cluster = member_to_cluster.get(constraint.source_id)
        target_cluster = member_to_cluster.get(constraint.target_id)
        if source_cluster is None or target_cluster is None:
            self._outcomes.append(_Outcome(constraint, False, "", REASON_NOT_IN_CANDIDATE))
        elif source_cluster != target_cluster:
            self._outcomes.append(_Outcome(constraint, False, "", REASON_DIFFERENT_CLUSTERS))
        else:
            self._by_cluster[source_cluster].append(constraint)

    def reconcile(self, cluster_index: int, groups: dict[str, list[str]]) -> dict[str, list[str]]:
        constraints = self._by_cluster.get(cluster_index)
        if not constraints:
            return groups
        source_cluster_id = self._source_id_by_index.get(cluster_index)
        member_to_key = {member: key for key, members in groups.items() for member in members}
        same_links = _UnionFind(list(member_to_key))
        for constraint in constraints:
            if constraint.type == "same_workflow":
                same_links.union(constraint.source_id, constraint.target_id)

        merged = self._apply_same_workflow(constraints, groups, member_to_key, source_cluster_id)
        return self._apply_separate_workflow(constraints, merged, same_links, source_cluster_id)

    def _apply_same_workflow(
        self,
        constraints: list[WorkflowFeedbackConstraint],
        groups: dict[str, list[str]],
        member_to_key: dict[str, str],
        source_cluster_id: Any,
    ) -> dict[str, list[str]]:
        group_links = _UnionFind(list(groups))
        for constraint in constraints:
            if constraint.type != "same_workflow":
                continue
            source_key = member_to_key.get(constraint.source_id)
            target_key = member_to_key.get(constraint.target_id)
            if source_key is None or target_key is None:
                self._outcomes.append(_Outcome(constraint, False, "", REASON_NOT_IN_CANDIDATE, source_cluster_id))
                continue
            if group_links.find(source_key) == group_links.find(target_key):
                self._outcomes.append(_Outcome(constraint, True, EFFECT_ALREADY_SAME, "", source_cluster_id))
                continue
            group_links.union(source_key, target_key)
            self._outcomes.append(_Outcome(constraint, True, EFFECT_MERGED, "", source_cluster_id))

        merged: dict[str, list[str]] = defaultdict(list)
        for key, members in groups.items():
            merged[group_links.find(key)].extend(members)
        return dict(merged)

    def _apply_separate_workflow(
        self,
        constraints: list[WorkflowFeedbackConstraint],
        groups: dict[str, list[str]],
        same_links: _UnionFind,
        source_cluster_id: Any,
    ) -> dict[str, list[str]]:
        member_to_key = {member: key for key, members in groups.items() for member in members}
        separate_seq = 0
        for constraint in constraints:
            if constraint.type != "separate_workflow":
                continue
            if same_links.find(constraint.source_id) == same_links.find(constraint.target_id):
                self._outcomes.append(_Outcome(constraint, False, "", REASON_CONFLICT, source_cluster_id))
                continue
            source_key = member_to_key.get(constraint.source_id)
            target_key = member_to_key.get(constraint.target_id)
            if source_key is None or target_key is None:
                self._outcomes.append(_Outcome(constraint, False, "", REASON_NOT_IN_CANDIDATE, source_cluster_id))
                continue
            if source_key != target_key:
                self._outcomes.append(_Outcome(constraint, True, EFFECT_ALREADY_SEPARATE, "", source_cluster_id))
                continue
            new_key = f"{SEPARATE_GROUP_PREFIX}:{separate_seq}"
            separate_seq += 1
            groups[source_key].remove(constraint.target_id)
            groups[new_key] = [constraint.target_id]
            member_to_key[constraint.target_id] = new_key
            self._outcomes.append(_Outcome(constraint, True, EFFECT_SPLIT, "", source_cluster_id))
        return groups

    def report(self, entrypoints: list[dict[str, Any]]) -> dict[str, Any]:
        entrypoint_by_member = self._entrypoint_by_member(entrypoints)
        applied = [outcome for outcome in self._outcomes if outcome.applied]
        ignored = [outcome for outcome in self._outcomes if not outcome.applied]
        merge_count = sum(1 for outcome in applied if outcome.effect == EFFECT_MERGED)
        split_count = sum(1 for outcome in applied if outcome.effect == EFFECT_SPLIT)
        return {
            "workflowConstraintCount": self._constraint_count,
            "appliedWorkflowConstraintCount": len(applied),
            "ignoredWorkflowConstraintCount": len(ignored),
            "workflowMergeByFeedbackCount": merge_count,
            "workflowSplitByFeedbackCount": split_count,
            "workflowFeedback": {
                "applied": [self._applied_detail(outcome, entrypoint_by_member) for outcome in applied],
                "ignored": [self._ignored_detail(outcome) for outcome in ignored],
            },
        }

    @staticmethod
    def _entrypoint_by_member(entrypoints: list[dict[str, Any]]) -> dict[str, Any]:
        lookup: dict[str, Any] = {}
        for entrypoint in entrypoints:
            entry_point_id = entrypoint.get("entryPointId")
            for member in _string_list(entrypoint.get("memberConversationIds")):
                lookup[member] = entry_point_id
        return lookup

    @staticmethod
    def _applied_detail(outcome: _Outcome, entrypoint_by_member: dict[str, Any]) -> dict[str, Any]:
        return {
            "sourceId": outcome.constraint.source_id,
            "targetId": outcome.constraint.target_id,
            "type": outcome.constraint.type,
            "effect": outcome.effect,
            "sourceClusterId": outcome.source_cluster_id,
            "sourceEntryPointId": entrypoint_by_member.get(outcome.constraint.source_id),
            "targetEntryPointId": entrypoint_by_member.get(outcome.constraint.target_id),
        }

    @staticmethod
    def _ignored_detail(outcome: _Outcome) -> dict[str, Any]:
        return {
            "sourceId": outcome.constraint.source_id,
            "targetId": outcome.constraint.target_id,
            "type": outcome.constraint.type,
            "reason": outcome.reason,
        }


__all__ = ["WorkflowFeedbackReconciler"]
