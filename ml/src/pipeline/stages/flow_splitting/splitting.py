from __future__ import annotations

from collections import defaultdict
from typing import Any

from .constants import (
    ACTION_OBJECT_SPLIT_PREFIX,
    ACTION_SPLIT_PREFIX,
    AUTO_LABEL_MIN_MEMBER_COUNT,
    COMPOUND_SPLIT_SEPARATOR,
    MIN_SPLIT_SIZE,
)
from .helpers import (
    _event_sequence_key,
    _flow_group_key,
    _resolve_expanded_min_split_size,
    _signal_key,
    _split_name,
    _string_list,
)
from .labeling import (
    _frame_confidence,
    _frame_object_value,
    _frame_value,
    _is_action_label_term,
    _is_split_label_term,
    _regenerated_split_label,
    _review_safe_generated_label,
    _split_label_auto_acceptable,
)
from .novel import _stabilized_novel_label


def _flow_groups(
    cluster: dict[str, Any],
    preprocessed_index: dict[str, dict[str, Any]],
    strategy: str = "conservative",
    min_split_size: int = MIN_SPLIT_SIZE,
) -> dict[str, list[str]]:
    member_ids = _string_list(cluster.get("member_conv_ids"))
    if strategy == "conservative":
        return {"single_flow": member_ids}

    grouped: dict[str, list[str]] = defaultdict(list)
    for conv_id in member_ids:
        conversation = preprocessed_index.get(conv_id, {})
        ended_status = str(conversation.get("ended_status") or "unknown")
        signal = conversation.get("workflow_signal", cluster.get("workflow_signal"))
        signal_key = _signal_key(signal if isinstance(signal, dict) else {})
        grouped[_flow_group_key(ended_status, signal_key)].append(conv_id)
    if len(grouped) <= 1:
        base_groups = dict(grouped)
        if strategy == "expanded":
            expanded_groups = _expanded_action_object_groups(base_groups, preprocessed_index, min_split_size)
            expanded_groups = _expanded_action_groups(expanded_groups, preprocessed_index, min_split_size)
            return _expanded_sequence_groups(expanded_groups, preprocessed_index, min_split_size)
        for fallback_groups in (
            _action_object_flow_groups(member_ids, preprocessed_index, min_split_size),
            _action_flow_groups(member_ids, preprocessed_index, min_split_size),
            _sequence_flow_groups(member_ids, preprocessed_index, min_split_size),
        ):
            if len(fallback_groups) > 1:
                return fallback_groups
        return base_groups
    groups = _major_groups_with_residual(grouped, min_split_size)
    if strategy == "expanded":
        base_groups = groups if groups else {"mixed_flow": member_ids}
        expanded_groups = _expanded_action_object_groups(base_groups, preprocessed_index, min_split_size)
        expanded_groups = _expanded_action_groups(expanded_groups, preprocessed_index, min_split_size)
        expanded_groups = _expanded_sequence_groups(expanded_groups, preprocessed_index, min_split_size)
        if len(expanded_groups) > 1:
            return expanded_groups

    if len(groups) > 1:
        return groups

    for fallback_groups in (
        _action_object_flow_groups(member_ids, preprocessed_index, min_split_size),
        _action_flow_groups(member_ids, preprocessed_index, min_split_size),
        _sequence_flow_groups(member_ids, preprocessed_index, min_split_size),
    ):
        if len(fallback_groups) > 1:
            return fallback_groups

    if groups:
        return groups
    return {"mixed_flow": member_ids}


def _expanded_action_object_groups(
    base_groups: dict[str, list[str]],
    preprocessed_index: dict[str, dict[str, Any]],
    min_split_size: int,
) -> dict[str, list[str]]:
    expanded: dict[str, list[str]] = {}
    expanded_min_size = _resolve_expanded_min_split_size(min_split_size)
    for base_key, member_ids in base_groups.items():
        if len(member_ids) < expanded_min_size * 2:
            expanded[base_key] = member_ids
            continue
        action_object_groups = _action_object_flow_groups(member_ids, preprocessed_index, expanded_min_size)
        if len(action_object_groups) <= 1:
            expanded[base_key] = member_ids
            continue
        for action_key, action_member_ids in action_object_groups.items():
            expanded[f"{base_key}{COMPOUND_SPLIT_SEPARATOR}{action_key}"] = action_member_ids
    return expanded


def _expanded_action_groups(
    base_groups: dict[str, list[str]],
    preprocessed_index: dict[str, dict[str, Any]],
    min_split_size: int,
) -> dict[str, list[str]]:
    expanded: dict[str, list[str]] = {}
    expanded_min_size = _resolve_expanded_min_split_size(min_split_size)
    for base_key, member_ids in base_groups.items():
        if len(member_ids) < expanded_min_size * 2:
            expanded[base_key] = member_ids
            continue
        action_groups = _action_flow_groups(member_ids, preprocessed_index, expanded_min_size)
        if len(action_groups) <= 1:
            expanded[base_key] = member_ids
            continue
        for action_key, action_member_ids in action_groups.items():
            expanded[f"{base_key}{COMPOUND_SPLIT_SEPARATOR}{action_key}"] = action_member_ids
    return expanded


def _expanded_sequence_groups(
    base_groups: dict[str, list[str]],
    preprocessed_index: dict[str, dict[str, Any]],
    min_split_size: int,
) -> dict[str, list[str]]:
    expanded: dict[str, list[str]] = {}
    expanded_min_size = _resolve_expanded_min_split_size(min_split_size)
    for base_key, member_ids in base_groups.items():
        if len(member_ids) < expanded_min_size * 2:
            expanded[base_key] = member_ids
            continue
        sequence_groups = _sequence_flow_groups(member_ids, preprocessed_index, expanded_min_size)
        if len(sequence_groups) <= 1:
            expanded[base_key] = member_ids
            continue
        for sequence_key, sequence_member_ids in sequence_groups.items():
            expanded[f"{base_key}{COMPOUND_SPLIT_SEPARATOR}{sequence_key}"] = sequence_member_ids
    return expanded


def _action_object_flow_groups(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    min_split_size: int,
) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    unknown_members: list[str] = []
    for conv_id in member_ids:
        key = _action_object_sequence_key(preprocessed_index.get(conv_id))
        if not key:
            unknown_members.append(conv_id)
            continue
        grouped[key].append(conv_id)
    groups = _major_groups_with_residual(grouped, min_split_size)
    if len(groups) <= 1:
        return {}
    if unknown_members:
        groups.setdefault("mixed_residual", []).extend(unknown_members)
    return groups


def _action_object_sequence_key(conversation: object) -> str:
    if not isinstance(conversation, dict):
        return ""
    frame = conversation.get("action_object_frame")
    if not isinstance(frame, dict) or _frame_confidence(frame) < 0.65:
        return ""
    object_term = _frame_object_value(frame)
    action = _frame_value(frame, "action")
    if not object_term or not action:
        return ""
    if not _is_split_label_term(object_term) or not _is_action_label_term(action):
        return ""
    return f"{ACTION_OBJECT_SPLIT_PREFIX}{object_term}>{action}"


def _action_flow_groups(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    min_split_size: int,
) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    unknown_members: list[str] = []
    for conv_id in member_ids:
        key = _action_sequence_key(preprocessed_index.get(conv_id))
        if not key:
            unknown_members.append(conv_id)
            continue
        grouped[key].append(conv_id)
    groups = _major_groups_with_residual(grouped, min_split_size)
    if len(groups) <= 1:
        return {}
    if unknown_members:
        groups.setdefault("mixed_residual", []).extend(unknown_members)
    return groups


def _action_sequence_key(conversation: object) -> str:
    if not isinstance(conversation, dict):
        return ""
    frame = conversation.get("action_object_frame")
    if not isinstance(frame, dict) or _frame_confidence(frame) < 0.55:
        return ""
    action = _frame_value(frame, "action")
    if not _is_action_label_term(action):
        return ""
    return f"{ACTION_SPLIT_PREFIX}{action}"


def _major_groups_with_residual(
    grouped: dict[str, list[str]],
    min_split_size: int,
) -> dict[str, list[str]]:
    major_groups = {key: value for key, value in grouped.items() if len(value) >= min_split_size}
    if not major_groups:
        return {}
    residual = [conv_id for key, values in grouped.items() if key not in major_groups for conv_id in values]
    if residual:
        major_groups["mixed_residual"] = residual
    return major_groups


def _sequence_flow_groups(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    min_split_size: int,
) -> dict[str, list[str]]:
    for max_events in (4, 3, 2):
        grouped: dict[str, list[str]] = defaultdict(list)
        for conv_id in member_ids:
            key = _event_sequence_key(preprocessed_index.get(conv_id), max_events=max_events)
            grouped[key].append(conv_id)
        if len(grouped) <= 1:
            continue
        groups = _major_groups_with_residual(grouped, min_split_size)
        if len(groups) > 1:
            return groups
    return {}


def _apply_regenerated_label_metadata(
    target: dict[str, Any],
    source_cluster: dict[str, Any],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    split_key: str,
) -> None:
    label = _review_safe_generated_label(
        _stabilized_novel_label(source_cluster, _regenerated_split_label(member_ids, preprocessed_index)),
        member_ids,
        preprocessed_index,
        split_key,
    )
    target["suggested_name"] = label["name"] or _split_name(
        str(source_cluster.get("suggested_name") or "Intent"), split_key
    )
    target["label_source"] = "flow_split_regenerated_terms"
    target["label_score"] = label["score"]
    target["label_evidence_coverage"] = label["evidenceCoverage"]
    target["label_member_evidence_coverage"] = label.get("memberEvidenceCoverage")
    target["label_object_coverage"] = label.get("objectCoverage")
    target["label_action_coverage"] = label.get("actionCoverage")
    target["label_object_action_joint_coverage"] = label.get("objectActionJointCoverage")
    target["label_action_object_validity"] = label.get("actionObjectValidity")
    target["label_candidates"] = label.get("candidates", [])
    target["action_object_frame"] = label.get("actionObjectFrame", {})
    target["label_validation_status"] = (
        "auto_acceptable"
        if len(member_ids) >= AUTO_LABEL_MIN_MEMBER_COUNT and _split_label_auto_acceptable(label)
        else "needs_review"
    )
