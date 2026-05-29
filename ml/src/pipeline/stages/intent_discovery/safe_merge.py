from __future__ import annotations

from collections import Counter
from collections.abc import Mapping, Sequence
from typing import Any

import numpy as np

from pipeline.stages.intent_discovery.types import ProcessedConversation

DEFAULT_SAFE_MERGE_THRESHOLD = 0.82


def safe_merge_microclusters(
    valid_clusters: Mapping[int, list[int]],
    conversations: Sequence[ProcessedConversation],
    semantic_vectors: np.ndarray,
    flow_signatures: np.ndarray,
    *,
    min_merge_score: float = DEFAULT_SAFE_MERGE_THRESHOLD,
) -> tuple[dict[int, list[int]], dict[str, Any]]:
    if len(valid_clusters) <= 1:
        return dict(valid_clusters), _report(len(valid_clusters), len(valid_clusters), 0, 0, min_merge_score)

    cluster_ids = sorted(valid_clusters)
    semantic_centroids = _centroids(semantic_vectors, valid_clusters)
    flow_centroids = _centroids(flow_signatures, valid_clusters)
    parent = {cluster_id: cluster_id for cluster_id in cluster_ids}
    blocked_conflict_count = 0
    merge_edge_count = 0

    def find(cluster_id: int) -> int:
        current = cluster_id
        while parent[current] != current:
            parent[current] = parent[parent[current]]
            current = parent[current]
        return current

    def union(left: int, right: int) -> None:
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    candidates: list[tuple[float, int, int]] = []
    for position, left in enumerate(cluster_ids):
        for right in cluster_ids[position + 1 :]:
            merge_score, has_conflict = _merge_score(
                left,
                right,
                valid_clusters,
                conversations,
                semantic_centroids,
                flow_centroids,
            )
            if has_conflict:
                blocked_conflict_count += 1
                continue
            if merge_score >= min_merge_score:
                candidates.append((merge_score, left, right))

    for _score, left, right in sorted(candidates, reverse=True):
        if find(left) == find(right):
            continue
        union(left, right)
        merge_edge_count += 1

    grouped: dict[int, list[int]] = {}
    for cluster_id in cluster_ids:
        grouped.setdefault(find(cluster_id), []).extend(valid_clusters[cluster_id])
    merged = {
        new_cluster_id: sorted(member_indices)
        for new_cluster_id, member_indices in enumerate(grouped[root] for root in sorted(grouped))
    }
    return merged, _report(
        len(valid_clusters),
        len(merged),
        merge_edge_count,
        blocked_conflict_count,
        min_merge_score,
    )


def _merge_score(
    left_cluster_id: int,
    right_cluster_id: int,
    valid_clusters: Mapping[int, list[int]],
    conversations: Sequence[ProcessedConversation],
    semantic_centroids: Mapping[int, np.ndarray],
    flow_centroids: Mapping[int, np.ndarray],
) -> tuple[float, bool]:
    left_frame = _dominant_frame(valid_clusters[left_cluster_id], conversations)
    right_frame = _dominant_frame(valid_clusters[right_cluster_id], conversations)
    object_score, object_conflict = _frame_match(left_frame.get("object", ""), right_frame.get("object", ""))
    action_score, action_conflict = _frame_match(left_frame.get("action", ""), right_frame.get("action", ""))
    semantic_similarity = _cosine(semantic_centroids.get(left_cluster_id), semantic_centroids.get(right_cluster_id))
    flow_similarity = _cosine(flow_centroids.get(left_cluster_id), flow_centroids.get(right_cluster_id))
    signal_similarity = _signal_similarity(
        valid_clusters[left_cluster_id],
        valid_clusters[right_cluster_id],
        conversations,
    )
    has_conflict = (object_conflict or action_conflict) and semantic_similarity < 0.93
    score = (
        (0.42 * semantic_similarity)
        + (0.23 * ((object_score + action_score) / 2.0))
        + (0.22 * flow_similarity)
        + (0.13 * signal_similarity)
    )
    return max(0.0, min(1.0, score)), has_conflict


def _dominant_frame(member_indices: Sequence[int], conversations: Sequence[ProcessedConversation]) -> dict[str, str]:
    object_counts: Counter[str] = Counter()
    action_counts: Counter[str] = Counter()
    for index in member_indices:
        if index >= len(conversations):
            continue
        frame = conversations[index].metadata.get("actionObjectFrame")
        if not isinstance(frame, dict):
            continue
        object_term = _frame_value(frame, "object")
        action = _frame_value(frame, "action")
        if object_term:
            object_counts[object_term] += 1
        if action:
            action_counts[action] += 1
    return {
        "object": object_counts.most_common(1)[0][0] if object_counts else "",
        "action": action_counts.most_common(1)[0][0] if action_counts else "",
    }


def _frame_value(frame: Mapping[object, object], key: str) -> str:
    value = frame.get(key)
    return str(value).strip().casefold() if isinstance(value, str) else ""


def _frame_match(left: str, right: str) -> tuple[float, bool]:
    if not left and not right:
        return 0.5, False
    if not left or not right:
        return 0.45, False
    if left == right:
        return 1.0, False
    if left in right or right in left:
        return 0.75, False
    return 0.0, True


def _signal_similarity(
    left_members: Sequence[int],
    right_members: Sequence[int],
    conversations: Sequence[ProcessedConversation],
) -> float:
    left = _dominant_signals(left_members, conversations)
    right = _dominant_signals(right_members, conversations)
    if not left and not right:
        return 1.0
    union = left | right
    return len(left & right) / len(union) if union else 1.0


def _dominant_signals(member_indices: Sequence[int], conversations: Sequence[ProcessedConversation]) -> set[str]:
    counts: Counter[str] = Counter()
    for index in member_indices:
        if index >= len(conversations):
            continue
        counts.update(key for key, enabled in conversations[index].workflow_signal.items() if enabled is True)
    if not counts:
        return set()
    threshold = max(1, len(member_indices) // 2)
    return {key for key, count in counts.items() if count >= threshold}


def _centroids(vectors: np.ndarray, valid_clusters: Mapping[int, list[int]]) -> dict[int, np.ndarray]:
    return {
        cluster_id: vectors[indices].mean(axis=0).astype(np.float32, copy=False)
        for cluster_id, indices in valid_clusters.items()
        if indices and vectors.shape[0] > max(indices)
    }


def _cosine(left: np.ndarray | None, right: np.ndarray | None) -> float:
    if left is None or right is None:
        return 0.0
    left_norm = float(np.linalg.norm(left))
    right_norm = float(np.linalg.norm(right))
    if left_norm <= 1e-9 or right_norm <= 1e-9:
        return 0.0
    return max(0.0, min(1.0, float(left @ right / (left_norm * right_norm))))


def _report(
    input_count: int,
    output_count: int,
    merge_edge_count: int,
    blocked_conflict_count: int,
    min_merge_score: float,
) -> dict[str, Any]:
    return {
        "safeMergeInputClusterCount": input_count,
        "safeMergeOutputClusterCount": output_count,
        "safeMergeMergedClusterCount": max(0, input_count - output_count),
        "safeMergeMergeEdgeCount": merge_edge_count,
        "safeMergeBlockedConflictCount": blocked_conflict_count,
        "safeMergeMinScore": min_merge_score,
    }


__all__ = ["DEFAULT_SAFE_MERGE_THRESHOLD", "safe_merge_microclusters"]
