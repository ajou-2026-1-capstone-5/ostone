from __future__ import annotations

# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportAny=false
import math
from collections.abc import Mapping, Sequence
from typing import Any

import igraph as ig  # type: ignore[import-untyped]
import leidenalg  # type: ignore[import-untyped]
import numpy as np
from sklearn.neighbors import NearestNeighbors  # type: ignore[import-untyped]

from pipeline.stages.intent_discovery.types import DEFAULT_KNN_K, DEFAULT_LEIDEN_RESOLUTION, DEFAULT_MIN_CLUSTER_SIZE

DEFAULT_FLOW_AFFINITY_WEIGHT = 0.08
DEFAULT_AFFINITY_MIN_SIMILARITY = 0.05
DEFAULT_NON_MUTUAL_KEEP_QUANTILE = 0.90
DEFAULT_COMPACTION_HDBSCAN_OVERRIDE_SIMILARITY = 0.94
DEFAULT_COMPACTION_HDBSCAN_MIN_PURITY = 0.55
DEFAULT_OUTLIER_REASSIGN_STRONG_SIMILARITY = 0.80
DEFAULT_OUTLIER_REASSIGN_SIMILARITY = 0.72
DEFAULT_OUTLIER_REASSIGN_MARGIN = 0.01
DEFAULT_OUTLIER_REASSIGN_FRAME_CONFIDENCE = 0.75
DEFAULT_OUTLIER_REASSIGN_OBJECT_QUALITY = 0.55


def combine_with_flow(embeddings: np.ndarray, flow_signatures: np.ndarray, weight: float = 0.5) -> np.ndarray:
    if not 0.0 <= weight <= 1.0:
        raise ValueError("weight must be between 0.0 and 1.0.")
    if embeddings.shape[0] != flow_signatures.shape[0]:
        raise ValueError("embeddings and flow_signatures must have the same row count.")

    hybrid = np.concatenate(
        [
            _l2norm(embeddings) * math.sqrt(1.0 - weight),
            _l2norm(flow_signatures) * math.sqrt(weight),
        ],
        axis=-1,
    )
    return hybrid.astype(np.float32, copy=False)


def build_knn_graph(vectors: np.ndarray, k: int = DEFAULT_KNN_K, metric: str = "cosine") -> ig.Graph:
    node_count = int(vectors.shape[0])
    if node_count == 0:
        return ig.Graph(n=0, directed=False)

    neighbor_count = min(k + 1, node_count)
    neighbors = NearestNeighbors(n_neighbors=neighbor_count, metric=metric)
    neighbors.fit(vectors)
    distances, indices = neighbors.kneighbors(vectors)

    edge_weights: dict[tuple[int, int], float] = {}
    for source, (row_distances, row_indices) in enumerate(zip(distances, indices)):
        for distance, target in zip(row_distances, row_indices):
            target_index = int(target)
            if source == target_index:
                continue
            edge = (source, target_index) if source < target_index else (target_index, source)
            similarity = _distance_to_similarity(float(distance), metric)
            edge_weights[edge] = max(similarity, edge_weights.get(edge, 0.0))

    edge_list = list(edge_weights)
    graph = ig.Graph(n=node_count, edges=edge_list, directed=False)
    graph.es["weight"] = [edge_weights[edge] for edge in edge_list]
    return graph


def build_hybrid_affinity_graph(
    semantic_vectors: np.ndarray,
    flow_signatures: np.ndarray | None = None,
    *,
    k: int = DEFAULT_KNN_K,
    flow_weight: float = DEFAULT_FLOW_AFFINITY_WEIGHT,
    min_similarity: float = DEFAULT_AFFINITY_MIN_SIMILARITY,
    non_mutual_keep_quantile: float = DEFAULT_NON_MUTUAL_KEEP_QUANTILE,
) -> ig.Graph:
    if not 0.0 <= flow_weight <= 1.0:
        raise ValueError("flow_weight must be between 0.0 and 1.0.")
    if not 0.0 <= non_mutual_keep_quantile <= 1.0:
        raise ValueError("non_mutual_keep_quantile must be between 0.0 and 1.0.")
    node_count = int(semantic_vectors.shape[0])
    if node_count == 0:
        return ig.Graph(n=0, directed=False)
    if flow_signatures is not None and flow_signatures.shape[0] != node_count:
        raise ValueError("semantic_vectors and flow_signatures must have the same row count.")
    if node_count == 1:
        return ig.Graph(n=1, directed=False)

    similarity = _hybrid_similarity_matrix(semantic_vectors, flow_signatures, flow_weight=flow_weight)
    neighbor_count = min(max(1, k), node_count - 1)
    neighbor_indices = np.argsort(-similarity, axis=1, kind="stable")[:, :neighbor_count]
    neighbor_sets = [set(int(index) for index in row) for row in neighbor_indices]
    sigma = _local_scale(similarity, neighbor_indices)
    candidate_similarities = [
        float(similarity[source, int(target)]) for source, row in enumerate(neighbor_indices) for target in row
    ]
    non_mutual_threshold = (
        float(np.quantile(np.asarray(candidate_similarities, dtype=np.float32), non_mutual_keep_quantile))
        if candidate_similarities
        else 1.0
    )

    edge_weights: dict[tuple[int, int], float] = {}
    for source, row in enumerate(neighbor_indices):
        for raw_target in row:
            target = int(raw_target)
            if source == target:
                continue
            score = float(similarity[source, target])
            if score < min_similarity:
                continue
            is_mutual = source in neighbor_sets[target]
            if not is_mutual and score < non_mutual_threshold:
                continue
            distance = max(0.0, 1.0 - score)
            scale = max(float(sigma[source] * sigma[target]), 1e-8)
            local_weight = math.exp(-((distance * distance) / scale))
            weight = local_weight * (1.15 if is_mutual else 0.85)
            edge = (source, target) if source < target else (target, source)
            edge_weights[edge] = max(weight, edge_weights.get(edge, 0.0))

    edge_list = list(edge_weights)
    graph = ig.Graph(n=node_count, edges=edge_list, directed=False)
    graph.es["weight"] = [edge_weights[edge] for edge in edge_list]
    return graph


def estimate_cluster_stability(
    semantic_vectors: np.ndarray,
    flow_signatures: np.ndarray,
    valid_clusters: Mapping[int, list[int]],
    *,
    k_values: Sequence[int] = (8, 12, 20),
    resolution_values: Sequence[float] = (1.2, 1.6),
    flow_weights: Sequence[float] = (0.0, DEFAULT_FLOW_AFFINITY_WEIGHT),
    seeds: Sequence[int] = (7, 42),
) -> dict[str, Any]:
    if semantic_vectors.shape[0] == 0 or not valid_clusters:
        return {
            "clusterStability": None,
            "clusterStabilityRunCount": 0,
            "clusterStabilityByCluster": {},
        }
    labels_by_run: list[list[int]] = []
    for k_value in k_values:
        for resolution in resolution_values:
            for flow_weight in flow_weights:
                graph = build_hybrid_affinity_graph(
                    semantic_vectors,
                    flow_signatures,
                    k=k_value,
                    flow_weight=flow_weight,
                )
                for seed in seeds:
                    labels_by_run.append(detect_communities(graph, resolution=resolution, seed=seed))
    cluster_scores: dict[int, float] = {}
    for cluster_id, member_indices in valid_clusters.items():
        cluster_scores[int(cluster_id)] = _cluster_pair_stability(member_indices, labels_by_run)
    values = list(cluster_scores.values())
    return {
        "clusterStability": float(np.mean(np.asarray(values, dtype=np.float32))) if values else None,
        "clusterStabilityRunCount": len(labels_by_run),
        "clusterStabilityByCluster": cluster_scores,
    }


def hdbscan_assist_summary(
    vectors: np.ndarray,
    valid_clusters: Mapping[int, list[int]],
    *,
    min_cluster_size: int = DEFAULT_MIN_CLUSTER_SIZE,
    flow_signatures: np.ndarray | None = None,
    flow_weight: float = DEFAULT_FLOW_AFFINITY_WEIGHT,
    min_samples: int | None = None,
) -> dict[str, Any]:
    node_count = int(vectors.shape[0])
    if node_count < max(2, min_cluster_size):
        return {
            "hdbscanAvailable": False,
            "hdbscanReason": "insufficient_rows",
            "hdbscanNoiseRate": None,
            "hdbscanSplitCandidateCount": 0,
            "hdbscanLabels": [],
        }
    try:
        from sklearn.cluster import HDBSCAN  # type: ignore[import-untyped]
    except (ImportError, AttributeError):
        return {
            "hdbscanAvailable": False,
            "hdbscanReason": "unavailable",
            "hdbscanNoiseRate": None,
            "hdbscanSplitCandidateCount": 0,
            "hdbscanLabels": [],
        }

    hdbscan_vectors = (
        combine_with_flow(vectors, flow_signatures, weight=flow_weight)
        if flow_signatures is not None and flow_signatures.shape[0] == vectors.shape[0] and flow_weight > 0.0
        else _l2norm(vectors)
    )
    labels = HDBSCAN(
        min_cluster_size=max(2, min_cluster_size),
        min_samples=min_samples if min_samples is not None else max(1, min_cluster_size // 3),
        cluster_selection_method="eom",
        copy=True,
    ).fit_predict(hdbscan_vectors)
    split_candidates = 0
    for member_indices in valid_clusters.values():
        dense_labels = {int(labels[index]) for index in member_indices if int(labels[index]) >= 0}
        if len(dense_labels) > 1:
            split_candidates += 1
    noise_count = sum(1 for label in labels if int(label) == -1)
    return {
        "hdbscanAvailable": True,
        "hdbscanReason": None,
        "hdbscanNoiseRate": noise_count / node_count if node_count else None,
        "hdbscanSplitCandidateCount": split_candidates,
        "hdbscanLabels": [int(label) for label in labels],
        "hdbscanFlowWeight": flow_weight if flow_signatures is not None else 0.0,
    }


def refine_clusters_with_hdbscan(
    valid_clusters: Mapping[int, list[int]],
    outlier_node_indices: set[int],
    hdbscan_labels: Sequence[int],
    *,
    min_size: int = DEFAULT_MIN_CLUSTER_SIZE,
) -> tuple[set[int], dict[int, list[int]], dict[str, int]]:
    if not hdbscan_labels:
        return (
            set(outlier_node_indices),
            dict(valid_clusters),
            {
                "hdbscanRefinedClusterCount": 0,
                "hdbscanSplitClusterCount": 0,
                "hdbscanNoiseMemberCount": 0,
                "hdbscanPrunedMemberCount": 0,
            },
        )

    next_cluster_id = (max(valid_clusters) + 1) if valid_clusters else 0
    refined: dict[int, list[int]] = {}
    outliers = set(outlier_node_indices)
    split_cluster_count = 0
    refined_cluster_count = 0
    noise_member_count = 0
    pruned_member_count = 0

    for cluster_id, member_indices in sorted(valid_clusters.items()):
        grouped: dict[int, list[int]] = {}
        noise_members: list[int] = []
        for index in member_indices:
            label = int(hdbscan_labels[index]) if index < len(hdbscan_labels) else -1
            if label < 0:
                noise_members.append(index)
                continue
            grouped.setdefault(label, []).append(index)

        major_groups = [members for members in grouped.values() if len(members) >= min_size]
        if len(major_groups) < 2:
            if len(major_groups) == 1:
                dense_members = sorted(major_groups[0])
                residual_members = [
                    index for members in grouped.values() if len(members) < min_size for index in members
                ]
                pruned_members = residual_members + noise_members
                dense_ratio = len(dense_members) / len(member_indices) if member_indices else 0.0
                if pruned_members and dense_ratio >= 0.72 and len(dense_members) >= min_size:
                    refined[cluster_id] = dense_members
                    outliers.update(pruned_members)
                    pruned_member_count += len(pruned_members)
                    continue
            refined[cluster_id] = list(member_indices)
            continue

        split_cluster_count += 1
        for members in major_groups:
            refined[next_cluster_id] = sorted(members)
            next_cluster_id += 1
            refined_cluster_count += 1
        residual_members = [index for members in grouped.values() if len(members) < min_size for index in members]
        outliers.update(residual_members)
        outliers.update(noise_members)
        noise_member_count += len(residual_members) + len(noise_members)

    return (
        outliers,
        refined,
        {
            "hdbscanRefinedClusterCount": refined_cluster_count,
            "hdbscanSplitClusterCount": split_cluster_count,
            "hdbscanNoiseMemberCount": noise_member_count,
            "hdbscanPrunedMemberCount": pruned_member_count,
        },
    )


def reassign_nearby_outliers(
    valid_clusters: Mapping[int, list[int]],
    outlier_node_indices: set[int],
    semantic_vectors: np.ndarray,
    conversations: Sequence[object],
    *,
    strong_similarity: float = DEFAULT_OUTLIER_REASSIGN_STRONG_SIMILARITY,
    min_similarity: float = DEFAULT_OUTLIER_REASSIGN_SIMILARITY,
    min_margin: float = DEFAULT_OUTLIER_REASSIGN_MARGIN,
    min_frame_confidence: float = DEFAULT_OUTLIER_REASSIGN_FRAME_CONFIDENCE,
    min_object_quality: float = DEFAULT_OUTLIER_REASSIGN_OBJECT_QUALITY,
) -> tuple[set[int], dict[int, list[int]], dict[str, Any]]:
    if not valid_clusters or not outlier_node_indices or semantic_vectors.shape[0] == 0:
        return set(outlier_node_indices), dict(valid_clusters), _outlier_reassignment_report(0, 0, [])

    normalized = _l2norm(semantic_vectors.astype(np.float32, copy=False))
    centroids = {
        cluster_id: _l2norm(normalized[member_indices].mean(axis=0, keepdims=True))[0]
        for cluster_id, member_indices in valid_clusters.items()
        if member_indices
    }
    if not centroids:
        return (
            set(outlier_node_indices),
            dict(valid_clusters),
            _outlier_reassignment_report(len(outlier_node_indices), 0, []),
        )

    cluster_actions = {
        cluster_id: _dominant_action(member_indices, conversations)
        for cluster_id, member_indices in valid_clusters.items()
    }
    reassigned: list[dict[str, Any]] = []
    remaining = set(outlier_node_indices)
    output = {cluster_id: list(member_indices) for cluster_id, member_indices in valid_clusters.items()}
    for index in sorted(outlier_node_indices):
        if index >= normalized.shape[0]:
            continue
        nearest = _nearest_centroids(normalized[index], centroids)
        if not nearest:
            continue
        best_cluster_id, best_similarity = nearest[0]
        second_similarity = nearest[1][1] if len(nearest) > 1 else 0.0
        margin = best_similarity - second_similarity
        frame = _conversation_frame(conversations, index)
        frame_confidence = _frame_confidence(frame)
        object_quality = _frame_object_quality(frame)
        action = _frame_value(frame, "action")
        target_action = cluster_actions.get(best_cluster_id, "")
        action_compatible = not target_action or not action or target_action == action
        if not _should_reassign_outlier(
            best_similarity=best_similarity,
            margin=margin,
            frame_confidence=frame_confidence,
            object_quality=object_quality,
            action_compatible=action_compatible,
            strong_similarity=strong_similarity,
            min_similarity=min_similarity,
            min_margin=min_margin,
            min_frame_confidence=min_frame_confidence,
            min_object_quality=min_object_quality,
        ):
            continue
        output.setdefault(best_cluster_id, []).append(index)
        remaining.discard(index)
        reassigned.append(
            {
                "nodeIndex": index,
                "targetClusterId": best_cluster_id,
                "similarity": round(best_similarity, 6),
                "margin": round(margin, 6),
                "frameConfidence": round(frame_confidence, 6),
                "objectQuality": round(object_quality, 6),
                "actionCompatible": action_compatible,
            }
        )

    return remaining, output, _outlier_reassignment_report(len(outlier_node_indices), len(reassigned), reassigned)


def _nearest_centroids(vector: np.ndarray, centroids: Mapping[int, np.ndarray]) -> list[tuple[int, float]]:
    return sorted(
        ((cluster_id, float(vector @ centroid)) for cluster_id, centroid in centroids.items()),
        key=lambda item: (-item[1], item[0]),
    )


def _should_reassign_outlier(
    *,
    best_similarity: float,
    margin: float,
    frame_confidence: float,
    object_quality: float,
    action_compatible: bool,
    strong_similarity: float,
    min_similarity: float,
    min_margin: float,
    min_frame_confidence: float,
    min_object_quality: float,
) -> bool:
    if best_similarity >= strong_similarity and margin >= min_margin:
        has_grounded_frame = frame_confidence >= min_frame_confidence and object_quality >= min_object_quality
        if action_compatible and has_grounded_frame:
            return True
        very_strong_similarity = max(strong_similarity + 0.08, 0.88)
        very_clear_margin = max(min_margin, 0.05)
        return best_similarity >= very_strong_similarity and margin >= very_clear_margin
    if best_similarity < min_similarity or margin < min_margin:
        return False
    if frame_confidence < min_frame_confidence or object_quality < min_object_quality:
        return False
    if not action_compatible and best_similarity < (strong_similarity - 0.02):
        return False
    return True


def _dominant_action(member_indices: Sequence[int], conversations: Sequence[object]) -> str:
    counts: dict[str, int] = {}
    for index in member_indices:
        frame = _conversation_frame(conversations, index)
        action = _frame_value(frame, "action")
        if not action or _frame_confidence(frame) < min(DEFAULT_OUTLIER_REASSIGN_FRAME_CONFIDENCE, 0.70):
            continue
        counts[action] = counts.get(action, 0) + 1
    if not counts:
        return ""
    action, support = max(counts.items(), key=lambda item: (item[1], item[0]))
    support_ratio = support / len(member_indices) if member_indices else 0.0
    return action if support_ratio >= 0.55 else ""


def _conversation_frame(conversations: Sequence[object], index: int) -> Mapping[str, object]:
    if index >= len(conversations):
        return {}
    metadata = getattr(conversations[index], "metadata", None)
    if not isinstance(metadata, Mapping):
        return {}
    frame = metadata.get("actionObjectFrame")
    return frame if isinstance(frame, Mapping) else {}


def _frame_value(frame: Mapping[str, object], key: str) -> str:
    value = frame.get(key)
    return str(value).strip().casefold() if isinstance(value, str) else ""


def _frame_confidence(frame: Mapping[str, object]) -> float:
    value = frame.get("confidence")
    return _clip(float(value)) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0.0


def _frame_object_quality(frame: Mapping[str, object]) -> float:
    value = frame.get("objectQuality")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return _clip(float(value))
    return 1.0 if _frame_value(frame, "object") else 0.0


def _clip(value: float) -> float:
    return max(0.0, min(1.0, value))


def _outlier_reassignment_report(
    input_count: int,
    reassigned_count: int,
    sample: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "outlierReassignmentInputCount": input_count,
        "outlierReassignmentCount": reassigned_count,
        "outlierReassignmentSample": sample[:20],
        "outlierReassignmentStrongSimilarity": DEFAULT_OUTLIER_REASSIGN_STRONG_SIMILARITY,
        "outlierReassignmentMinSimilarity": DEFAULT_OUTLIER_REASSIGN_SIMILARITY,
        "outlierReassignmentMinMargin": DEFAULT_OUTLIER_REASSIGN_MARGIN,
    }


def compact_clusters_by_centroid_similarity(
    valid_clusters: Mapping[int, list[int]],
    semantic_vectors: np.ndarray,
    *,
    similarity_threshold: float,
    hdbscan_labels: Sequence[int] = (),
    hdbscan_override_similarity: float = DEFAULT_COMPACTION_HDBSCAN_OVERRIDE_SIMILARITY,
    hdbscan_min_purity: float = DEFAULT_COMPACTION_HDBSCAN_MIN_PURITY,
) -> tuple[dict[int, list[int]], dict[str, Any]]:
    if not 0.0 <= similarity_threshold <= 1.0:
        raise ValueError("similarity_threshold must be between 0.0 and 1.0.")
    if not valid_clusters:
        return {}, _cluster_compaction_report(
            input_count=0,
            output_count=0,
            threshold=similarity_threshold,
            merge_edge_count=0,
            blocked_by_hdbscan_count=0,
            hdbscan_aware=bool(hdbscan_labels),
        )

    cluster_ids = sorted(valid_clusters)
    normalized = _l2norm(semantic_vectors.astype(np.float32, copy=False))
    centroids = {
        cluster_id: _l2norm(normalized[member_indices].mean(axis=0, keepdims=True))[0]
        for cluster_id, member_indices in valid_clusters.items()
        if member_indices
    }
    parent = {cluster_id: cluster_id for cluster_id in cluster_ids}

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

    pair_candidates: list[tuple[float, int, int]] = []
    for position, left in enumerate(cluster_ids):
        if left not in centroids:
            continue
        for right in cluster_ids[position + 1 :]:
            if right not in centroids:
                continue
            similarity = float(centroids[left] @ centroids[right])
            if similarity >= similarity_threshold:
                pair_candidates.append((similarity, left, right))

    merge_edge_count = 0
    blocked_by_hdbscan_count = 0
    for similarity, left, right in sorted(pair_candidates, reverse=True):
        if _hdbscan_blocks_compaction(
            valid_clusters[left],
            valid_clusters[right],
            hdbscan_labels,
            similarity=similarity,
            override_similarity=hdbscan_override_similarity,
            min_purity=hdbscan_min_purity,
        ):
            blocked_by_hdbscan_count += 1
            continue
        union(left, right)
        merge_edge_count += 1

    grouped: dict[int, list[int]] = {}
    for cluster_id in cluster_ids:
        grouped.setdefault(find(cluster_id), []).extend(valid_clusters[cluster_id])
    compacted = {
        new_cluster_id: sorted(member_indices)
        for new_cluster_id, member_indices in enumerate(grouped[root] for root in sorted(grouped))
    }
    return compacted, _cluster_compaction_report(
        input_count=len(valid_clusters),
        output_count=len(compacted),
        threshold=similarity_threshold,
        merge_edge_count=merge_edge_count,
        blocked_by_hdbscan_count=blocked_by_hdbscan_count,
        hdbscan_aware=bool(hdbscan_labels),
    )


def detect_communities(
    graph: ig.Graph,
    resolution: float = DEFAULT_LEIDEN_RESOLUTION,
    seed: int = 42,
) -> list[int]:
    partition = leidenalg.find_partition(
        graph,
        leidenalg.RBConfigurationVertexPartition,
        weights="weight" if "weight" in graph.es.attributes() else None,
        resolution_parameter=resolution,
        seed=seed,
    )
    return list(partition.membership)


def identify_outliers(
    memberships: Sequence[int],
    min_size: int = DEFAULT_MIN_CLUSTER_SIZE,
) -> tuple[set[int], dict[int, list[int]]]:
    clusters: dict[int, list[int]] = {}
    for node_index, cluster_id in enumerate(memberships):
        clusters.setdefault(cluster_id, []).append(node_index)

    outlier_node_indices: set[int] = set()
    valid_clusters: dict[int, list[int]] = {}
    for cluster_id, member_indices in clusters.items():
        if len(member_indices) < min_size:
            outlier_node_indices.update(member_indices)
            continue
        valid_clusters[cluster_id] = member_indices
    return outlier_node_indices, valid_clusters


def compute_centroids(vectors: np.ndarray, valid_clusters: Mapping[int, list[int]]) -> dict[int, np.ndarray]:
    return {
        cluster_id: vectors[indices].mean(axis=0).astype(np.float32, copy=False)
        for cluster_id, indices in valid_clusters.items()
    }


def _hybrid_similarity_matrix(
    semantic_vectors: np.ndarray,
    flow_signatures: np.ndarray | None,
    *,
    flow_weight: float,
) -> np.ndarray:
    semantic = _l2norm(semantic_vectors)
    similarity = np.clip(semantic @ semantic.T, 0.0, 1.0).astype(np.float32, copy=False)
    if flow_signatures is None or flow_weight <= 0.0:
        np.fill_diagonal(similarity, -np.inf)
        return similarity

    flow = _l2norm(flow_signatures)
    flow_similarity = np.clip(flow @ flow.T, 0.0, 1.0).astype(np.float32, copy=False)
    similarity = ((1.0 - flow_weight) * similarity + flow_weight * flow_similarity).astype(np.float32, copy=False)
    np.fill_diagonal(similarity, -np.inf)
    return similarity


def _local_scale(similarity: np.ndarray, neighbor_indices: np.ndarray) -> np.ndarray:
    scales = np.zeros((similarity.shape[0],), dtype=np.float32)
    for row_index, row in enumerate(neighbor_indices):
        if row.size == 0:
            scales[row_index] = 1.0
            continue
        kth_similarity = float(similarity[row_index, int(row[-1])])
        scales[row_index] = max(1e-3, 1.0 - kth_similarity)
    return scales


def _cluster_pair_stability(member_indices: list[int], labels_by_run: Sequence[Sequence[int]]) -> float:
    if len(member_indices) <= 1:
        return 1.0
    if not labels_by_run:
        return 0.0
    run_scores: list[float] = []
    for labels in labels_by_run:
        same_count = 0
        pair_count = 0
        for left_position, left in enumerate(member_indices):
            for right in member_indices[left_position + 1 :]:
                pair_count += 1
                same_count += labels[left] == labels[right]
        run_scores.append(same_count / pair_count if pair_count else 1.0)
    return float(np.mean(np.asarray(run_scores, dtype=np.float32))) if run_scores else 0.0


def _hdbscan_blocks_compaction(
    left_members: Sequence[int],
    right_members: Sequence[int],
    hdbscan_labels: Sequence[int],
    *,
    similarity: float,
    override_similarity: float,
    min_purity: float,
) -> bool:
    if not hdbscan_labels:
        return False
    left_label, left_purity = _dominant_hdbscan_label(left_members, hdbscan_labels)
    right_label, right_purity = _dominant_hdbscan_label(right_members, hdbscan_labels)
    if left_label is None or right_label is None or left_label == right_label:
        return False
    if left_purity < min_purity or right_purity < min_purity:
        return False
    return similarity < override_similarity


def _dominant_hdbscan_label(member_indices: Sequence[int], hdbscan_labels: Sequence[int]) -> tuple[int | None, float]:
    counts: dict[int, int] = {}
    for index in member_indices:
        if index >= len(hdbscan_labels):
            continue
        label = int(hdbscan_labels[index])
        if label < 0:
            continue
        counts[label] = counts.get(label, 0) + 1
    if not counts or not member_indices:
        return None, 0.0
    label, count = max(counts.items(), key=lambda item: (item[1], -item[0]))
    return label, count / len(member_indices)


def _cluster_compaction_report(
    *,
    input_count: int,
    output_count: int,
    threshold: float,
    merge_edge_count: int,
    blocked_by_hdbscan_count: int,
    hdbscan_aware: bool,
) -> dict[str, Any]:
    return {
        "clusterCompactionInputClusterCount": input_count,
        "clusterCompactionOutputClusterCount": output_count,
        "clusterCompactionMergedClusterCount": max(0, input_count - output_count),
        "clusterCompactionMergeEdgeCount": merge_edge_count,
        "clusterCompactionThreshold": threshold,
        "clusterCompactionBlockedByHdbscanCount": blocked_by_hdbscan_count,
        "clusterCompactionHdbscanAware": hdbscan_aware,
    }


def _l2norm(vectors: np.ndarray) -> np.ndarray:
    values = vectors.astype(np.float32, copy=True)
    norms = np.linalg.norm(values, axis=1, keepdims=True)
    normalized = np.zeros_like(values, dtype=np.float32)
    _ = np.divide(values, norms, out=normalized, where=norms > 0.0)
    return normalized.astype(np.float32, copy=False)


def _distance_to_similarity(distance: float, metric: str) -> float:
    if metric == "cosine":
        return max(0.0, 1.0 - distance)
    return 1.0 / (1.0 + max(0.0, distance))


__all__ = [
    "build_knn_graph",
    "build_hybrid_affinity_graph",
    "combine_with_flow",
    "compact_clusters_by_centroid_similarity",
    "compute_centroids",
    "detect_communities",
    "estimate_cluster_stability",
    "hdbscan_assist_summary",
    "identify_outliers",
    "reassign_nearby_outliers",
    "refine_clusters_with_hdbscan",
]
