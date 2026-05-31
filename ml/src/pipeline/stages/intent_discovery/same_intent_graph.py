from __future__ import annotations

import math
from collections import Counter, defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

import igraph as ig  # type: ignore[import-untyped]
import numpy as np

from pipeline.stages.intent_discovery.feedback_constraints import FeedbackConstraint
from pipeline.stages.intent_discovery.types import ProcessedConversation

DEFAULT_SAME_INTENT_THRESHOLD = 0.55
AMBIGUOUS_LOW = 0.45
AMBIGUOUS_HIGH = 0.60
MIN_FRAME_CONFIDENCE_FOR_MATCH = 0.55
MIN_FRAME_CONFIDENCE_FOR_CONFLICT = 0.72
MIN_FRAME_CONFIDENCE_FOR_BUCKET = 0.68
MIN_FRAME_OBJECT_QUALITY_FOR_MATCH = 0.45
_GENERIC_ISSUE_TOKENS = frozenset(
    {
        "문의",
        "문의합니다",
        "확인",
        "해주세요",
        "부탁드립니다",
        "가능한가요",
        "가능할까요",
        "되나요",
        "그리고",
        "혹시",
        "안녕하세요",
        "감사합니다",
        "수고했습니다",
    }
)
_COMPATIBLE_OBJECT_SCOPES = (
    frozenset({"요금", "요금제", "청구", "청구서", "납부"}),
    frozenset({"휴대폰", "핸드폰", "폰", "단말기", "기기"}),
    frozenset({"카드", "카드사"}),
)


@dataclass(frozen=True)
class SameIntentPairFeatures:
    source: int
    target: int
    customer_issue_cosine: float
    flow_cosine: float
    workflow_signal_jaccard: float
    outcome_match: float
    object_match: float
    action_match: float
    quality_score: float
    object_conflict: bool
    object_scope_conflict: bool
    action_conflict: bool
    slot_schema_conflict: bool
    outcome_conflict: bool
    low_quality_pair: bool
    boundary_uncertainty: bool
    customer_issue_specificity: float
    mutual_neighbor: bool


def build_same_intent_probability_graph(
    conversations: Sequence[ProcessedConversation],
    semantic_vectors: np.ndarray,
    flow_signatures: np.ndarray | None,
    *,
    k: int,
    base_threshold: float = DEFAULT_SAME_INTENT_THRESHOLD,
    constraints: Sequence[FeedbackConstraint] = (),
) -> tuple[ig.Graph, dict[str, Any]]:
    node_count = len(conversations)
    if node_count == 0:
        return ig.Graph(n=0, directed=False), _empty_report()
    if node_count == 1:
        return ig.Graph(n=1, directed=False), {**_empty_report(), "nodeCount": 1}

    semantic_similarity = _cosine_matrix(semantic_vectors)
    flow_similarity = (
        _cosine_matrix(flow_signatures) if flow_signatures is not None else np.zeros_like(semantic_similarity)
    )
    neighbor_count = min(max(1, k), node_count - 1)
    neighbor_indices = np.argsort(-semantic_similarity, axis=1, kind="stable")[:, :neighbor_count]
    neighbor_sets = [set(int(index) for index in row) for row in neighbor_indices]
    candidate_pairs = _candidate_pairs(conversations, neighbor_indices, constraints)
    constraint_lookup = _constraint_lookup(conversations, constraints)

    source_scores: dict[int, list[float]] = defaultdict(list)
    scored_pairs: dict[tuple[int, int], tuple[float, SameIntentPairFeatures]] = {}
    cannot_link_skipped = 0
    must_link_edges = 0
    for source, target in sorted(candidate_pairs):
        constraint = constraint_lookup.get((source, target))
        if constraint is not None and constraint.type == "cannot_link":
            cannot_link_skipped += 1
            continue
        features = _pair_features(
            source,
            target,
            conversations,
            semantic_similarity,
            flow_similarity,
            mutual_neighbor=source in neighbor_sets[target] and target in neighbor_sets[source],
        )
        score = _same_intent_score(features)
        if constraint is not None and constraint.type == "must_link":
            score = max(score, 0.96 * constraint.confidence)
            must_link_edges += 1
        scored_pairs[(source, target)] = (score, features)
        source_scores[source].append(score)
        source_scores[target].append(score)

    hubness = Counter(index for pair in candidate_pairs for index in pair)
    edge_weights: dict[tuple[int, int], float] = {}
    ambiguous_pair_count = 0
    conflict_pair_count = 0
    ambiguous_edge_count = 0
    conflict_edge_count = 0
    slot_schema_conflict_pair_count = 0
    boundary_uncertain_pair_count = 0
    for pair, (score, features) in scored_pairs.items():
        is_ambiguous = AMBIGUOUS_LOW <= score <= AMBIGUOUS_HIGH
        is_conflict = (
            features.object_conflict
            or features.object_scope_conflict
            or features.action_conflict
            or features.slot_schema_conflict
        )
        if is_ambiguous:
            ambiguous_pair_count += 1
        if is_conflict:
            conflict_pair_count += 1
        if features.slot_schema_conflict:
            slot_schema_conflict_pair_count += 1
        if features.boundary_uncertainty:
            boundary_uncertain_pair_count += 1
        constraint = constraint_lookup.get(pair)
        if features.object_scope_conflict and (constraint is None or constraint.type != "must_link"):
            continue
        threshold = _adaptive_threshold(
            pair,
            source_scores,
            base_threshold=base_threshold,
            mutual=features.mutual_neighbor,
        )
        if score < threshold:
            continue
        if is_ambiguous:
            ambiguous_edge_count += 1
        if is_conflict:
            conflict_edge_count += 1
        edge_weights[pair] = _hubness_adjusted_weight(score, pair, hubness)

    edge_list = list(edge_weights)
    edge_hubness = Counter(index for pair in edge_list for index in pair)
    scored_pair_count = len(scored_pairs)
    edge_count = len(edge_list)
    edge_hubness_max_degree = max(edge_hubness.values(), default=0)
    conflict_pair_rate = _rate(conflict_pair_count, scored_pair_count)
    ambiguous_pair_rate = _rate(ambiguous_pair_count, scored_pair_count)
    edge_conflict_rate = _rate(conflict_edge_count, edge_count)
    edge_ambiguous_rate = _rate(ambiguous_edge_count, edge_count)
    graph = ig.Graph(n=node_count, edges=edge_list, directed=False)
    graph.es["weight"] = [edge_weights[edge] for edge in edge_list]
    return graph, {
        "schemaVersion": "same-intent-graph.v1",
        "nodeCount": node_count,
        "candidatePairCount": len(candidate_pairs),
        "scoredPairCount": scored_pair_count,
        "edgeCount": edge_count,
        "baseThreshold": base_threshold,
        "avgEdgeProbability": float(np.mean(np.asarray(list(edge_weights.values()), dtype=np.float32)))
        if edge_weights
        else 0.0,
        "ambiguousPairCount": ambiguous_pair_count,
        "conflictPairCount": conflict_pair_count,
        "slotSchemaConflictPairCount": slot_schema_conflict_pair_count,
        "boundaryUncertainPairCount": boundary_uncertain_pair_count,
        "ambiguousEdgeCount": ambiguous_edge_count,
        "conflictEdgeCount": conflict_edge_count,
        "ambiguousPairRate": ambiguous_pair_rate,
        "conflictPairRate": conflict_pair_rate,
        "edgeAmbiguousRate": edge_ambiguous_rate,
        "edgeConflictRate": edge_conflict_rate,
        "overmergeRisk": _overmerge_risk(
            edge_conflict_rate=edge_conflict_rate,
            edge_ambiguous_rate=edge_ambiguous_rate,
            conflict_pair_rate=conflict_pair_rate,
            edge_hubness_max_degree=edge_hubness_max_degree,
            node_count=node_count,
        ),
        "mustLinkEdgeCount": must_link_edges,
        "cannotLinkSkippedCount": cannot_link_skipped,
        "hubnessMaxCandidateDegree": max(hubness.values(), default=0),
        "edgeHubnessMaxDegree": edge_hubness_max_degree,
        "edgeHubnessMeanDegree": float(np.mean(np.asarray(list(edge_hubness.values()), dtype=np.float32)))
        if edge_hubness
        else 0.0,
    }


def _candidate_pairs(
    conversations: Sequence[ProcessedConversation],
    neighbor_indices: np.ndarray,
    constraints: Sequence[FeedbackConstraint],
) -> set[tuple[int, int]]:
    pairs: set[tuple[int, int]] = set()
    for source, row in enumerate(neighbor_indices):
        for raw_target in row:
            target = int(raw_target)
            if source != target:
                pairs.add(_ordered_pair(source, target))
    for bucket in _frame_buckets(conversations).values():
        for left_position, left in enumerate(bucket[:80]):
            for right in bucket[left_position + 1 : 80]:
                pairs.add(_ordered_pair(left, right))
    id_to_index = {conversation.id: index for index, conversation in enumerate(conversations)}
    for constraint in constraints:
        if constraint.source_id in id_to_index and constraint.target_id in id_to_index:
            pairs.add(_ordered_pair(id_to_index[constraint.source_id], id_to_index[constraint.target_id]))
    return pairs


def _frame_buckets(conversations: Sequence[ProcessedConversation]) -> dict[tuple[str, str], list[int]]:
    buckets: dict[tuple[str, str], list[int]] = defaultdict(list)
    for index, conversation in enumerate(conversations):
        frame = _action_object_frame(conversation)
        if (
            _frame_confidence(frame) < MIN_FRAME_CONFIDENCE_FOR_BUCKET
            or _frame_object_quality(frame) < MIN_FRAME_OBJECT_QUALITY_FOR_MATCH
        ):
            continue
        object_term = _frame_value(frame, "object")
        action = _frame_value(frame, "action")
        if object_term and action:
            buckets[(object_term, action)].append(index)
    return buckets


def _constraint_lookup(
    conversations: Sequence[ProcessedConversation],
    constraints: Sequence[FeedbackConstraint],
) -> dict[tuple[int, int], FeedbackConstraint]:
    id_to_index = {conversation.id: index for index, conversation in enumerate(conversations)}
    output: dict[tuple[int, int], FeedbackConstraint] = {}
    for constraint in constraints:
        source = id_to_index.get(constraint.source_id)
        target = id_to_index.get(constraint.target_id)
        if source is None or target is None:
            continue
        output[_ordered_pair(source, target)] = constraint
    return output


def _pair_features(
    source: int,
    target: int,
    conversations: Sequence[ProcessedConversation],
    semantic_similarity: np.ndarray,
    flow_similarity: np.ndarray,
    *,
    mutual_neighbor: bool,
) -> SameIntentPairFeatures:
    left = conversations[source]
    right = conversations[target]
    left_frame = _action_object_frame(left)
    right_frame = _action_object_frame(right)
    left_confidence = _frame_confidence(left_frame)
    right_confidence = _frame_confidence(right_frame)
    left_object = _confident_frame_value(left_frame, "object", left_confidence)
    right_object = _confident_frame_value(right_frame, "object", right_confidence)
    left_action = _confident_frame_value(left_frame, "action", left_confidence)
    right_action = _confident_frame_value(right_frame, "action", right_confidence)
    high_confidence_pair = (
        left_confidence >= MIN_FRAME_CONFIDENCE_FOR_CONFLICT and right_confidence >= MIN_FRAME_CONFIDENCE_FOR_CONFLICT
    )
    semantic_score = _clip(float(semantic_similarity[source, target]))
    outcome_match = 1.0 if (left.ended_status or "unknown") == (right.ended_status or "unknown") else 0.0
    quality = min(_quality_score(left), _quality_score(right))
    workflow_signal_jaccard = _jaccard(
        _enabled_signals(left.workflow_signal),
        _enabled_signals(right.workflow_signal),
    )
    object_match = _soft_match(left_object, right_object)
    action_match = _soft_match(left_action, right_action)
    object_hard_conflict = bool(
        high_confidence_pair
        and left_object
        and right_object
        and object_match < 0.35
        and (action_match < 0.35 or semantic_score < 0.70)
    )
    object_scope_conflict = _object_scope_conflict(
        left_object,
        right_object,
        high_confidence_pair=high_confidence_pair,
        object_match=object_match,
        action_match=action_match,
        semantic_score=semantic_score,
    )
    return SameIntentPairFeatures(
        source=source,
        target=target,
        customer_issue_cosine=semantic_score,
        flow_cosine=_clip(float(flow_similarity[source, target])) if flow_similarity.size else 0.0,
        workflow_signal_jaccard=workflow_signal_jaccard,
        outcome_match=outcome_match,
        object_match=object_match,
        action_match=action_match,
        quality_score=quality,
        object_conflict=object_hard_conflict,
        object_scope_conflict=object_scope_conflict,
        action_conflict=bool(high_confidence_pair and left_action and right_action and action_match < 0.35),
        slot_schema_conflict=_slot_schema_conflict(
            left,
            right,
            workflow_signal_jaccard=workflow_signal_jaccard,
            semantic_score=semantic_score,
        ),
        outcome_conflict=outcome_match == 0.0 and left.ended_status is not None and right.ended_status is not None,
        low_quality_pair=quality < 0.8,
        boundary_uncertainty=_boundary_uncertainty(left) or _boundary_uncertainty(right),
        customer_issue_specificity=min(_customer_issue_specificity(left), _customer_issue_specificity(right)),
        mutual_neighbor=mutual_neighbor,
    )


def _same_intent_score(features: SameIntentPairFeatures) -> float:
    score = (
        (0.34 * features.customer_issue_cosine)
        + (0.14 * features.flow_cosine)
        + (0.10 * features.workflow_signal_jaccard)
        + (0.10 * features.outcome_match)
        + (0.16 * features.object_match)
        + (0.12 * features.action_match)
        + (0.03 * features.quality_score)
        + (0.01 * features.customer_issue_specificity)
    )
    if features.object_conflict:
        score -= 0.25
    if features.object_scope_conflict:
        score -= 0.28
    if features.action_conflict:
        score -= 0.20
    if features.outcome_conflict and features.flow_cosine < 0.55:
        score -= 0.08
    if features.slot_schema_conflict:
        score -= 0.12
    if features.low_quality_pair:
        score -= 0.10
    if features.boundary_uncertainty:
        score -= 0.08
    if features.mutual_neighbor:
        score += 0.04
    return _clip(score)


def _adaptive_threshold(
    pair: tuple[int, int],
    source_scores: Mapping[int, Sequence[float]],
    *,
    base_threshold: float,
    mutual: bool,
) -> float:
    left_scores = source_scores.get(pair[0], ())
    right_scores = source_scores.get(pair[1], ())
    local_values = list(left_scores) + list(right_scores)
    if not local_values:
        return base_threshold
    local = float(np.quantile(np.asarray(local_values, dtype=np.float32), 0.52))
    threshold = max(base_threshold, local)
    if mutual:
        threshold -= 0.04
    return max(0.45, min(0.78, threshold))


def _hubness_adjusted_weight(score: float, pair: tuple[int, int], hubness: Counter[int]) -> float:
    left_degree = max(1, hubness[pair[0]])
    right_degree = max(1, hubness[pair[1]])
    hub_factor = 1.0 / math.sqrt(max(1.0, math.sqrt(left_degree * right_degree) / 12.0))
    return round(_clip(score * hub_factor), 6)


def _action_object_frame(conversation: ProcessedConversation) -> dict[str, object]:
    frame = conversation.metadata.get("actionObjectFrame")
    return dict(frame) if isinstance(frame, dict) else {}


def _frame_value(frame: Mapping[str, object], key: str) -> str:
    value = frame.get(key)
    return str(value).strip().casefold() if isinstance(value, str) else ""


def _confident_frame_value(frame: Mapping[str, object], key: str, confidence: float) -> str:
    if confidence < MIN_FRAME_CONFIDENCE_FOR_MATCH:
        return ""
    if key == "object" and _frame_object_quality(frame) < MIN_FRAME_OBJECT_QUALITY_FOR_MATCH:
        return ""
    return _frame_value(frame, key)


def _frame_confidence(frame: Mapping[str, object]) -> float:
    value = frame.get("confidence")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return _clip(float(value))
    return 0.0


def _frame_object_quality(frame: Mapping[str, object]) -> float:
    value = frame.get("objectQuality")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return _clip(float(value))
    object_term = _frame_value(frame, "object")
    return 1.0 if object_term else 0.0


def _quality_score(conversation: ProcessedConversation) -> float:
    value = conversation.metadata.get("qualityScore")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return _clip(float(value))
    tier = str(conversation.metadata.get("qualityTier") or "").upper()
    if tier == "A":
        return 1.0
    if tier == "B":
        return 0.85
    if tier == "C":
        return 0.65
    if tier == "D":
        return 0.0
    return 0.8


def _enabled_signals(signal: Mapping[str, bool]) -> set[str]:
    return {str(key) for key, value in signal.items() if value is True}


def _slot_schema_conflict(
    left: ProcessedConversation,
    right: ProcessedConversation,
    *,
    workflow_signal_jaccard: float,
    semantic_score: float,
) -> bool:
    left_signals = _enabled_signals(left.workflow_signal)
    right_signals = _enabled_signals(right.workflow_signal)
    if not left_signals or not right_signals:
        return False
    if workflow_signal_jaccard >= 0.20:
        return False
    return semantic_score < 0.78


def _object_scope_conflict(
    left_object: str,
    right_object: str,
    *,
    high_confidence_pair: bool,
    object_match: float,
    action_match: float,
    semantic_score: float,
) -> bool:
    if not high_confidence_pair or not left_object or not right_object:
        return False
    if object_match >= 0.35 or action_match < 0.75 or semantic_score >= 0.93:
        return False
    if _compatible_object_scope(left_object, right_object):
        return False
    return _object_specificity(left_object) >= 0.30 and _object_specificity(right_object) >= 0.30


def _compatible_object_scope(left_object: str, right_object: str) -> bool:
    left_terms = set(_issue_tokens(left_object))
    right_terms = set(_issue_tokens(right_object))
    if left_terms & right_terms:
        return True
    return any(left_terms & scope and right_terms & scope for scope in _COMPATIBLE_OBJECT_SCOPES)


def _object_specificity(object_text: str) -> float:
    useful_tokens = [
        token
        for token in _issue_tokens(object_text)
        if token not in _GENERIC_ISSUE_TOKENS and not any(char.isdigit() for char in token)
    ]
    if not useful_tokens and len(object_text.strip()) >= 2:
        return 0.40
    return _clip(len(set(useful_tokens)) / 3.0)


def _boundary_uncertainty(conversation: ProcessedConversation) -> bool:
    quality = _quality_score(conversation)
    if quality < 0.75:
        return True
    flags = conversation.metadata.get("sourceQualityFlags")
    if not isinstance(flags, Sequence) or isinstance(flags, (str, bytes)):
        return False
    uncertain_flags = {
        "short_caselet",
        "no_agent_turn",
        "low_information_customer_issue",
        "deferred_or_declined_customer_issue",
    }
    return any(str(flag) in uncertain_flags for flag in flags)


def _customer_issue_specificity(conversation: ProcessedConversation) -> float:
    useful_tokens = [
        token
        for token in _issue_tokens(conversation.customer_problem_text)
        if token not in _GENERIC_ISSUE_TOKENS and not any(char.isdigit() for char in token)
    ]
    return _clip(len(set(useful_tokens)) / 5.0)


def _issue_tokens(text: str) -> list[str]:
    return [token.casefold() for token in text.replace("/", " ").split() if len(token.strip()) > 1]


def _jaccard(left: set[str], right: set[str]) -> float:
    if not left and not right:
        return 1.0
    union = left | right
    return len(left & right) / len(union) if union else 1.0


def _soft_match(left: str, right: str) -> float:
    if not left and not right:
        return 0.5
    if not left or not right:
        return 0.45
    if left == right:
        return 1.0
    if left in right or right in left:
        return 0.75
    return 0.18


def _cosine_matrix(vectors: np.ndarray | None) -> np.ndarray:
    if vectors is None or vectors.shape[0] == 0:
        return np.zeros((0, 0), dtype=np.float32)
    normalized = _l2norm(vectors.astype(np.float32, copy=False))
    similarity = normalized @ normalized.T
    np.fill_diagonal(similarity, -np.inf)
    return np.clip(similarity, 0.0, 1.0).astype(np.float32, copy=False)


def _l2norm(vectors: np.ndarray) -> np.ndarray:
    values = vectors.astype(np.float32, copy=True)
    norms = np.linalg.norm(values, axis=1, keepdims=True)
    normalized = np.zeros_like(values, dtype=np.float32)
    _ = np.divide(values, norms, out=normalized, where=norms > 0.0)
    return normalized.astype(np.float32, copy=False)


def _ordered_pair(left: int, right: int) -> tuple[int, int]:
    return (left, right) if left < right else (right, left)


def _clip(value: float) -> float:
    return max(0.0, min(1.0, value))


def _rate(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator > 0 else 0.0


def _overmerge_risk(
    *,
    edge_conflict_rate: float,
    edge_ambiguous_rate: float,
    conflict_pair_rate: float,
    edge_hubness_max_degree: int,
    node_count: int,
) -> float:
    hubness_risk = 0.0
    if node_count > 0:
        hubness_risk = _clip(edge_hubness_max_degree / max(4.0, node_count * 0.35))
    return round(
        _clip(
            (0.55 * edge_conflict_rate)
            + (0.20 * edge_ambiguous_rate)
            + (0.15 * conflict_pair_rate)
            + (0.10 * hubness_risk)
        ),
        4,
    )


def _empty_report() -> dict[str, Any]:
    return {
        "schemaVersion": "same-intent-graph.v1",
        "nodeCount": 0,
        "candidatePairCount": 0,
        "scoredPairCount": 0,
        "edgeCount": 0,
        "baseThreshold": DEFAULT_SAME_INTENT_THRESHOLD,
        "avgEdgeProbability": 0.0,
        "ambiguousPairCount": 0,
        "conflictPairCount": 0,
        "slotSchemaConflictPairCount": 0,
        "boundaryUncertainPairCount": 0,
        "ambiguousEdgeCount": 0,
        "conflictEdgeCount": 0,
        "ambiguousPairRate": 0.0,
        "conflictPairRate": 0.0,
        "edgeAmbiguousRate": 0.0,
        "edgeConflictRate": 0.0,
        "overmergeRisk": 0.0,
        "mustLinkEdgeCount": 0,
        "cannotLinkSkippedCount": 0,
        "hubnessMaxCandidateDegree": 0,
        "edgeHubnessMaxDegree": 0,
        "edgeHubnessMeanDegree": 0.0,
    }


__all__ = ["SameIntentPairFeatures", "build_same_intent_probability_graph"]
