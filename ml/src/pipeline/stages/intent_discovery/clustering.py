from __future__ import annotations

# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportAny=false
import math
from collections.abc import Mapping, Sequence

import igraph as ig  # type: ignore[import-untyped]
import leidenalg  # type: ignore[import-untyped]
import numpy as np
from sklearn.neighbors import NearestNeighbors  # type: ignore[import-untyped]

from pipeline.stages.intent_discovery.types import DEFAULT_KNN_K, DEFAULT_LEIDEN_RESOLUTION, DEFAULT_MIN_CLUSTER_SIZE


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
    "combine_with_flow",
    "compute_centroids",
    "detect_communities",
    "identify_outliers",
]
