from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass
from typing import Any

from pipeline.stages.flow_splitting.constants import (
    COMPOUND_SPLIT_SEPARATOR,
    WORKFLOW_HUMAN_REVIEW_CONFIDENCE_THRESHOLD,
    WORKFLOW_LABEL_BLOCKING_CONFIDENCE_THRESHOLD,
)

SELECTION_METRICS_ARTIFACT = "feedback_selection_metrics.json"
CANNOT_LINK_KIND = "cannot_link"
MUST_LINK_KIND = "must_link"
CASELET_EXPOSURE_CAP = 2
MUST_LINK_BUDGET_RATIO = 3
SOURCE_CLUSTER_CAP_RATIO = 4
PAIR_POOL_MULTIPLIER = 4
WEAK_MIXED_SPLIT_REASON = "mixed_split_reason"
WEAK_LOW_LABEL_CONFIDENCE = "low_label_confidence"
WEAK_ZERO_LABEL_EVIDENCE_COVERAGE = "zero_label_evidence_coverage"
_MIXED_SPLIT_REASONS = {"mixed_flow", "mixed_residual"}


@dataclass(frozen=True)
class QuestionCandidate:
    kind: str
    source_cluster_id: str
    cluster_id: str
    source_id: str
    target_id: str
    member_total: int
    confidence: float
    score: float
    weak_reasons: tuple[str, ...]

    @property
    def is_weak(self) -> bool:
        return bool(self.weak_reasons)


@dataclass
class SelectionResult:
    selected: list[QuestionCandidate]
    metrics: dict[str, Any]


def source_cluster_cap(limit: int) -> int:
    return max(1, math.ceil(limit / SOURCE_CLUSTER_CAP_RATIO))


def collect_candidates(
    entrypoints: list[dict[str, Any]],
    clusters: list[dict[str, Any]],
    *,
    limit: int,
) -> list[QuestionCandidate]:
    cluster_by_entrypoint = {
        entrypoint_id: cluster
        for cluster in clusters
        if (entrypoint_id := _text_id(cluster.get("workflow_entrypoint_id")))
    }
    raw = _cannot_link_raw(entrypoints, cluster_by_entrypoint, limit=limit)
    raw.extend(_must_link_raw(clusters))
    return _finalized(raw)


def select_candidates(candidates: list[QuestionCandidate], *, limit: int) -> SelectionResult:
    source_cap = source_cluster_cap(limit)
    strong = sorted((candidate for candidate in candidates if not candidate.is_weak), key=_order_key)
    weak = sorted((candidate for candidate in candidates if candidate.is_weak), key=_order_key)
    has_must_link = any(candidate.kind == MUST_LINK_KIND for candidate in candidates)
    must_link_budget = (limit // MUST_LINK_BUDGET_RATIO) if has_must_link else 0
    budgets = {MUST_LINK_KIND: must_link_budget, CANNOT_LINK_KIND: limit - must_link_budget}
    selected: list[QuestionCandidate] = []
    selected_set: set[QuestionCandidate] = set()
    per_source: Counter[str] = Counter()
    per_caselet: Counter[str] = Counter()
    kind_counts: Counter[str] = Counter()

    def cap_block_reason(candidate: QuestionCandidate) -> str | None:
        if candidate.source_cluster_id and per_source[candidate.source_cluster_id] >= source_cap:
            return "sourceClusterCap"
        if per_caselet[candidate.source_id] >= CASELET_EXPOSURE_CAP:
            return "caseletExposureCap"
        if per_caselet[candidate.target_id] >= CASELET_EXPOSURE_CAP:
            return "caseletExposureCap"
        return None

    # weak 후보는 strong 후보가 예산을 채우지 못한 잔여 슬롯만 가져간다.
    for pool, enforce_budget in ((strong, True), (strong, False), (weak, True), (weak, False)):
        for candidate in pool:
            if len(selected) >= limit:
                break
            if candidate in selected_set:
                continue
            if enforce_budget and kind_counts[candidate.kind] >= budgets[candidate.kind]:
                continue
            if cap_block_reason(candidate) is not None:
                continue
            selected.append(candidate)
            selected_set.add(candidate)
            per_source[candidate.source_cluster_id] += 1
            per_caselet[candidate.source_id] += 1
            per_caselet[candidate.target_id] += 1
            kind_counts[candidate.kind] += 1

    skipped: Counter[str] = Counter()
    for candidate in candidates:
        if candidate in selected_set:
            continue
        skipped[cap_block_reason(candidate) or "questionLimitReached"] += 1

    metrics = _selection_metrics(
        candidates,
        selected,
        limit=limit,
        source_cap=source_cap,
        budgets=budgets,
        kind_counts=kind_counts,
        per_source=per_source,
        per_caselet=per_caselet,
        skipped=skipped,
    )
    return SelectionResult(selected=selected, metrics=metrics)


def _order_key(candidate: QuestionCandidate) -> tuple[float, str, str, str, str]:
    return (-candidate.score, candidate.kind, candidate.source_cluster_id, candidate.source_id, candidate.target_id)


def _cannot_link_raw(
    entrypoints: list[dict[str, Any]],
    cluster_by_entrypoint: dict[str, dict[str, Any]],
    *,
    limit: int,
) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    pair_pool_cap = source_cluster_cap(limit) * PAIR_POOL_MULTIPLIER
    for source, items in _entrypoints_by_source(entrypoints).items():
        if len(items) < 2:
            continue
        ordered = sorted(items, key=lambda item: _float_or_zero(item.get("confidence")))
        for left, right in _diagonal_pairs(ordered, pair_pool_cap):
            pair = _representative_pair(left, right)
            if pair is None:
                continue
            output.append(
                {
                    "kind": CANNOT_LINK_KIND,
                    "source_cluster_id": source,
                    "cluster_id": "",
                    "source_id": pair[0],
                    "target_id": pair[1],
                    "member_total": _entrypoint_member_count(left) + _entrypoint_member_count(right),
                    "confidence": (_float_or_zero(left.get("confidence")) + _float_or_zero(right.get("confidence")))
                    / 2,
                    "weak_reasons": _pair_weak_reasons(left, right, cluster_by_entrypoint),
                }
            )
    return output


def _diagonal_pairs(
    ordered: list[dict[str, Any]],
    pair_pool_cap: int,
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    # 인접 confidence 조합부터 대각선 순서로 생성해 한 entrypoint가 후보 풀을 독식하지 않게 한다.
    pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for offset in range(1, len(ordered)):
        for index in range(len(ordered) - offset):
            if len(pairs) >= pair_pool_cap:
                return pairs
            pairs.append((ordered[index], ordered[index + offset]))
    return pairs


def _must_link_raw(clusters: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for cluster in clusters:
        member_ids = _string_list(cluster.get("exemplar_conv_ids")) or _string_list(cluster.get("member_conv_ids"))
        if len(member_ids) < 2:
            continue
        cluster_id = _text_id(cluster.get("cluster_id"))
        output.append(
            {
                "kind": MUST_LINK_KIND,
                "source_cluster_id": cluster_id or _text_id(cluster.get("source_cluster_id")),
                "cluster_id": cluster_id,
                "source_id": member_ids[0],
                "target_id": member_ids[1],
                "member_total": _cluster_member_count(cluster, fallback=len(member_ids)),
                "confidence": _float_or_zero(cluster.get("workflow_confidence") or cluster.get("confidence")),
                "weak_reasons": _cluster_weak_reasons(cluster),
            }
        )
    return output


def _finalized(raw: list[dict[str, Any]]) -> list[QuestionCandidate]:
    max_member_total = max((int(item["member_total"]) for item in raw), default=0)
    candidates: list[QuestionCandidate] = []
    for item in raw:
        impact = (int(item["member_total"]) / max_member_total) if max_member_total > 0 else 0.0
        score = round((0.5 * _uncertainty(float(item["confidence"]))) + (0.5 * impact), 6)
        candidates.append(
            QuestionCandidate(
                kind=str(item["kind"]),
                source_cluster_id=str(item["source_cluster_id"]),
                cluster_id=str(item["cluster_id"]),
                source_id=str(item["source_id"]),
                target_id=str(item["target_id"]),
                member_total=int(item["member_total"]),
                confidence=float(item["confidence"]),
                score=score,
                weak_reasons=tuple(item["weak_reasons"]),
            )
        )
    return candidates


def _uncertainty(confidence: float) -> float:
    center = WORKFLOW_HUMAN_REVIEW_CONFIDENCE_THRESHOLD
    return max(0.0, 1.0 - (abs(confidence - center) / center))


def _pair_weak_reasons(
    left: dict[str, Any],
    right: dict[str, Any],
    cluster_by_entrypoint: dict[str, dict[str, Any]],
) -> tuple[str, ...]:
    reasons: list[str] = []
    for entrypoint in (left, right):
        cluster = cluster_by_entrypoint.get(_text_id(entrypoint.get("entryPointId")), {})
        reasons.extend(_endpoint_weak_reasons(entrypoint, cluster))
    return _deduped(reasons)


def _endpoint_weak_reasons(entrypoint: dict[str, Any], cluster: dict[str, Any]) -> list[str]:
    reasons: list[str] = []
    split_reason = _text_id(entrypoint.get("splitReason")) or _text_id(cluster.get("flow_split_key"))
    if _is_mixed_split_reason(split_reason):
        reasons.append(WEAK_MIXED_SPLIT_REASON)
    label_confidence = _label_confidence(entrypoint, cluster)
    if label_confidence is not None and label_confidence < WORKFLOW_LABEL_BLOCKING_CONFIDENCE_THRESHOLD:
        reasons.append(WEAK_LOW_LABEL_CONFIDENCE)
    evidence_coverage = _float_or_none(cluster.get("label_evidence_coverage"))
    if evidence_coverage is not None and evidence_coverage <= 0.0:
        reasons.append(WEAK_ZERO_LABEL_EVIDENCE_COVERAGE)
    return reasons


def _cluster_weak_reasons(cluster: dict[str, Any]) -> tuple[str, ...]:
    return _deduped(_endpoint_weak_reasons({}, cluster))


def _label_confidence(entrypoint: dict[str, Any], cluster: dict[str, Any]) -> float | None:
    components = entrypoint.get("confidenceComponents")
    if isinstance(components, dict):
        value = _float_or_none(components.get("label"))
        if value is not None:
            return value
    return _float_or_none(cluster.get("label_score"))


def _is_mixed_split_reason(split_reason: str) -> bool:
    return split_reason in _MIXED_SPLIT_REASONS or split_reason.endswith(f"{COMPOUND_SPLIT_SEPARATOR}mixed_residual")


def _selection_metrics(
    candidates: list[QuestionCandidate],
    selected: list[QuestionCandidate],
    *,
    limit: int,
    source_cap: int,
    budgets: dict[str, int],
    kind_counts: Counter[str],
    per_source: Counter[str],
    per_caselet: Counter[str],
    skipped: Counter[str],
) -> dict[str, Any]:
    weak_reason_counts = Counter(reason for candidate in candidates for reason in candidate.weak_reasons)
    return {
        "schemaVersion": "feedback-selection-metrics.v1",
        "questionLimit": limit,
        "sourceClusterCap": source_cap,
        "caseletExposureCap": CASELET_EXPOSURE_CAP,
        "budgets": {"mustLink": budgets[MUST_LINK_KIND], "cannotLink": budgets[CANNOT_LINK_KIND]},
        "candidateCounts": {
            "cannotLink": _kind_candidate_counts(candidates, CANNOT_LINK_KIND),
            "mustLink": _kind_candidate_counts(candidates, MUST_LINK_KIND),
        },
        "selectedCounts": {
            "total": len(selected),
            "cannotLink": kind_counts[CANNOT_LINK_KIND],
            "mustLink": kind_counts[MUST_LINK_KIND],
            "weak": sum(1 for candidate in selected if candidate.is_weak),
        },
        "skippedCounts": dict(sorted(skipped.items())),
        "weakReasonCounts": dict(sorted(weak_reason_counts.items())),
        "selectedPerSourceCluster": {key: value for key, value in sorted(per_source.items()) if key},
        "maxCaseletExposure": max(per_caselet.values(), default=0),
    }


def _kind_candidate_counts(candidates: list[QuestionCandidate], kind: str) -> dict[str, int]:
    kind_candidates = [candidate for candidate in candidates if candidate.kind == kind]
    weak_count = sum(1 for candidate in kind_candidates if candidate.is_weak)
    return {
        "considered": len(kind_candidates),
        "strong": len(kind_candidates) - weak_count,
        "weak": weak_count,
    }


def _entrypoints_by_source(entrypoints: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    by_source: dict[str, list[dict[str, Any]]] = {}
    for entrypoint in entrypoints:
        source = _text_id(entrypoint.get("sourceClusterId"))
        if source:
            by_source.setdefault(source, []).append(entrypoint)
    return by_source


def _representative_pair(left: dict[str, Any], right: dict[str, Any]) -> tuple[str, str] | None:
    left_ids = _string_list(left.get("exemplarConversationIds")) or _string_list(left.get("memberConversationIds"))
    right_ids = _string_list(right.get("exemplarConversationIds")) or _string_list(right.get("memberConversationIds"))
    if not left_ids or not right_ids:
        return None
    return left_ids[0], right_ids[0]


def _entrypoint_member_count(entrypoint: dict[str, Any]) -> int:
    member_count = entrypoint.get("memberCount")
    if isinstance(member_count, int) and not isinstance(member_count, bool):
        return max(0, member_count)
    return len(_string_list(entrypoint.get("memberConversationIds")))


def _cluster_member_count(cluster: dict[str, Any], *, fallback: int) -> int:
    cluster_size = cluster.get("cluster_size")
    if isinstance(cluster_size, int) and not isinstance(cluster_size, bool):
        return max(0, cluster_size)
    member_count = len(_string_list(cluster.get("member_conv_ids")))
    return member_count if member_count > 0 else fallback


def _deduped(values: list[str]) -> tuple[str, ...]:
    output: list[str] = []
    for value in values:
        if value not in output:
            output.append(value)
    return tuple(output)


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [text for item in value if (text := str(item).strip())]


def _text_id(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _float_or_zero(value: object) -> float:
    return _float_or_none(value) or 0.0


def _float_or_none(value: object) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return None


__all__ = [
    "CANNOT_LINK_KIND",
    "MUST_LINK_KIND",
    "SELECTION_METRICS_ARTIFACT",
    "QuestionCandidate",
    "SelectionResult",
    "collect_candidates",
    "select_candidates",
    "source_cluster_cap",
]
