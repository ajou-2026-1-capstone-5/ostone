from __future__ import annotations

from typing import Any

from .constants import REVIEW_PLACEHOLDER_LABEL
from .helpers import (
    _clamp,
    _dominant_sequence_share,
    _dominant_signal_share,
    _float_value,
    _int_from_mapping,
    _merged_workflow_signal,
    _string_list,
)
from .labeling import (
    _regenerated_split_label,
    _split_label_terms,
    _weak_label_penalty,
)

def _promote_novel_candidates(
    clusters_payload: dict[str, Any],
    preprocessed_index: dict[str, dict[str, Any]],
    *,
    existing_member_ids: set[str],
    min_size: int,
) -> tuple[list[dict[str, Any]], dict[str, int | float]]:
    raw_candidates = clusters_payload.get("novel_candidates")
    raw_outlier_count = _int_from_mapping(clusters_payload.get("stats"), "outlier_count")
    input_count = _int_from_mapping(clusters_payload.get("stats"), "input_count")
    if not isinstance(raw_candidates, list):
        return [], _novel_candidate_report(0, 0, 0, raw_outlier_count, input_count)

    promoted: list[dict[str, Any]] = []
    skipped_count = 0
    represented_members: set[str] = set()
    for candidate in raw_candidates:
        if not isinstance(candidate, dict):
            skipped_count += 1
            continue
        member_ids = [
            member_id
            for member_id in _string_list(candidate.get("member_conv_ids"))
            if member_id in preprocessed_index
            and member_id not in existing_member_ids
            and member_id not in represented_members
        ]
        if len(member_ids) < min_size:
            skipped_count += 1
            continue
        promoted.append(_novel_candidate_cluster(candidate, member_ids, preprocessed_index))
        represented_members.update(member_ids)

    report = _novel_candidate_report(
        len(raw_candidates),
        len(promoted),
        len(represented_members),
        raw_outlier_count,
        input_count,
    )
    report["skippedNovelCandidateCount"] = skipped_count
    report["novelCandidateMinSize"] = min_size
    return promoted, report

def _novel_candidate_cluster(
    candidate: dict[str, Any],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    label = _stabilized_novel_label(candidate, _regenerated_split_label(member_ids, preprocessed_index))
    suggested_name = str(label.get("name") or candidate.get("suggested_name") or "미분류 문의").strip()
    label_score = min(_float_value(label.get("score"), default=0.0), 0.64)
    evidence_coverage = _float_value(label.get("evidenceCoverage"), default=0.0)
    member_evidence_coverage = _float_value(label.get("memberEvidenceCoverage"), default=evidence_coverage)
    workflow_consistency = _clamp(
        (0.55 * _dominant_sequence_share(member_ids, preprocessed_index))
        + (0.45 * _dominant_signal_share(member_ids, preprocessed_index))
    )
    return {
        "cluster_id": -1,
        "member_conv_ids": member_ids,
        "exemplar_conv_ids": member_ids[:5],
        "keywords": _split_label_terms(member_ids, preprocessed_index)[:8],
        "suggested_name": suggested_name,
        "suggested_description": f"{suggested_name} review 후보",
        "workflow_signal": _merged_workflow_signal(member_ids, preprocessed_index, {}),
        "quality": {
            "interpretability_score": max(0.35, min(0.62, label_score or evidence_coverage)),
            "workflow_consistency_score": workflow_consistency,
            "branching_explainability_score": min(0.60, workflow_consistency),
        },
        "review_hint": "novel_outlier_candidate",
        "label_source": "novel_outlier_candidate",
        "label_score": label_score,
        "label_evidence_coverage": evidence_coverage,
        "label_member_evidence_coverage": member_evidence_coverage,
        "label_object_coverage": label.get("objectCoverage"),
        "label_action_coverage": label.get("actionCoverage"),
        "label_object_action_joint_coverage": label.get("objectActionJointCoverage"),
        "label_action_object_validity": label.get("actionObjectValidity"),
        "label_candidates": label.get("candidates", []),
        "action_object_frame": label.get("actionObjectFrame", {}),
        "label_validation_status": "needs_review",
        "source_type": candidate.get("source_type"),
        "source_candidate_key": candidate.get("candidate_key"),
        "candidate_size": candidate.get("candidate_size"),
        "is_novel_outlier_candidate": True,
    }

def _stabilized_novel_label(source: dict[str, Any], label: dict[str, Any]) -> dict[str, Any]:
    if source.get("is_novel_outlier_candidate") is not True and not str(source.get("source_type") or "").startswith(
        "outlier_"
    ):
        return label
    evidence_coverage = _float_value(label.get("evidenceCoverage"), default=0.0)
    label_score = _float_value(label.get("score"), default=0.0)
    label_name = str(label.get("name") or "")
    if evidence_coverage >= 0.25 and label_score >= 0.58 and _weak_label_penalty(label_name) <= 0.10:
        return label
    fallback_name = _novel_fallback_name(source)
    score = min(label_score, 0.45)
    return {
        **label,
        "name": fallback_name,
        "score": score,
        "candidates": [
            {
                "name": fallback_name,
                "score": score,
                "source": "novel_candidate_fallback",
                "evidenceCoverage": evidence_coverage,
                "actionObjectValidity": _float_value(label.get("actionObjectValidity"), default=0.35),
            }
        ],
    }

def _novel_fallback_name(source: dict[str, Any]) -> str:
    source_type = str(source.get("source_type") or "")
    suggested_name = str(source.get("suggested_name") or "").strip()
    if source_type == "outlier_flow":
        return _novel_flow_fallback_name(source)
    if source_type == "outlier_status":
        return REVIEW_PLACEHOLDER_LABEL
    if suggested_name and not suggested_name.casefold().startswith("unknown"):
        return suggested_name
    return REVIEW_PLACEHOLDER_LABEL

def _novel_flow_fallback_name(source: dict[str, Any]) -> str:
    return REVIEW_PLACEHOLDER_LABEL

def _novel_candidate_report(
    input_count: int,
    promoted_count: int,
    represented_member_count: int,
    raw_outlier_count: int,
    total_input_count: int,
) -> dict[str, int | float]:
    unrepresented_count = max(0, raw_outlier_count - represented_member_count)
    return {
        "novelCandidateInputCount": input_count,
        "promotedNovelCandidateCount": promoted_count,
        "promotedNovelMemberCount": represented_member_count,
        "rawOutlierMemberCount": raw_outlier_count,
        "unrepresentedOutlierMemberCount": unrepresented_count,
        "representedOutlierCoverage": (represented_member_count / raw_outlier_count if raw_outlier_count > 0 else 0.0),
        "unrepresentedOutlierRate": unrepresented_count / total_input_count if total_input_count > 0 else 0.0,
    }
