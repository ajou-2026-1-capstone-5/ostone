from __future__ import annotations

# pyright: reportMissingTypeStubs=false, reportAny=false, reportUnknownArgumentType=false
from collections import Counter

import numpy as np

from pipeline.stages.preprocessing.types import ProcessedConversation


def interpretability_score(
    vectors: np.ndarray,
    cluster_indices: list[int],
    centroids: dict[int, np.ndarray] | None = None,
) -> float:
    members = _cluster_vectors(vectors, cluster_indices)
    member_count = int(members.shape[0])
    if member_count == 0:
        return 0.0

    centroid_score = _centroid_similarity_score(members, cluster_indices, centroids)
    if member_count == 1:
        return centroid_score

    pairwise_score = _mean_pairwise_similarity(members, minimum=-1.0)
    return _clip_score((pairwise_score + centroid_score) / 2.0)


def workflow_consistency_score(
    conversations: list[ProcessedConversation],
    valid_clusters: dict[int, list[int]],
) -> dict[str, float]:
    cluster_scores: list[float] = []

    for member_indices in valid_clusters.values():
        members = [conversations[index] for index in member_indices if 0 <= index < len(conversations)]
        if not members:
            continue

        status_score = _dominant_ratio([conversation.ended_status for conversation in members])
        channel_score = _dominant_ratio([conversation.channel for conversation in members])
        cluster_scores.append((status_score + channel_score) / 2.0)

    if not cluster_scores:
        return {"avg_consistency": 0.0}

    return {"avg_consistency": _clip_score(float(np.mean(cluster_scores)))}


def branching_explainability_score(vectors: np.ndarray, cluster_indices: list[int]) -> float | None:
    members = _cluster_vectors(vectors, cluster_indices)
    if int(members.shape[0]) <= 1:
        return None

    dispersion = 1.0 - _mean_pairwise_similarity(members, minimum=-1.0)
    return _clip_score(1.0 - dispersion)


def _cluster_vectors(vectors: np.ndarray, cluster_indices: list[int]) -> np.ndarray:
    if int(vectors.shape[0]) == 0 or not cluster_indices:
        return np.zeros((0, 0), dtype=np.float32)
    return vectors[cluster_indices].astype(np.float32, copy=False)


def _centroid_similarity_score(
    vectors: np.ndarray,
    cluster_indices: list[int],
    centroids: dict[int, np.ndarray] | None = None,
) -> float:
    if centroids is None:
        centroid = vectors.mean(axis=0)
        centroid_norm = float(np.linalg.norm(centroid))
        if centroid_norm == 0.0:
            return 0.0
        normalized_vectors = _l2_normalize(vectors)
        normalized_centroid = centroid / centroid_norm
        all_sims = normalized_vectors @ normalized_centroid
        return _clip_score(float(np.mean(np.clip(all_sims, 0.0, 1.0))))

    if not cluster_indices:
        return 0.0

    collected_sims: list[float] = []
    normalized_vectors = _l2_normalize(vectors)
    for i, cluster_id in enumerate(cluster_indices):
        if cluster_id not in centroids:
            continue
        centroid = centroids[cluster_id]
        centroid_norm = float(np.linalg.norm(centroid))
        if centroid_norm == 0.0:
            continue
        normalized_centroid = centroid / centroid_norm
        sim = float(normalized_vectors[i] @ normalized_centroid)
        collected_sims.append(sim)

    if not collected_sims:
        return 0.0
    return _clip_score(float(np.mean(np.clip(collected_sims, 0.0, 1.0))))


def _mean_pairwise_similarity(vectors: np.ndarray, minimum: float) -> float:
    member_count = int(vectors.shape[0])
    if member_count <= 1:
        return 1.0

    normalized_vectors = _l2_normalize(vectors)
    similarities = normalized_vectors @ normalized_vectors.T
    row_indices, column_indices = np.triu_indices(member_count, k=1)
    pairwise = similarities[row_indices, column_indices]
    if int(pairwise.size) == 0:
        return 1.0
    return _clip_score(float(np.mean(np.clip(pairwise, minimum, 1.0))))


def _l2_normalize(vectors: np.ndarray) -> np.ndarray:
    values = vectors.astype(np.float32, copy=True)
    norms = np.linalg.norm(values, axis=1, keepdims=True)
    normalized = np.zeros_like(values, dtype=np.float32)
    _ = np.divide(values, norms, out=normalized, where=norms > 0.0)
    return normalized.astype(np.float32, copy=False)


def _dominant_ratio(values: list[str | None]) -> float:
    if not values:
        return 0.0
    counts = Counter(values)
    return _clip_score(max(counts.values()) / len(values))


def _clip_score(score: float) -> float:
    return min(1.0, max(0.0, score))


__all__ = [
    "branching_explainability_score",
    "interpretability_score",
    "workflow_consistency_score",
]
