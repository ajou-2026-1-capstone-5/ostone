from __future__ import annotations

from typing import Any

import numpy as np

FINAL_SEMANTIC_MODEL_HINT = "bge-m3"


def build_semantic_quality_report(
    *,
    semantic_embeddings: np.ndarray,
    valid_clusters: dict[int, list[int]],
    embedding_runtime: str,
    embedding_model_name: str,
    embedding_source: str,
) -> dict[str, Any]:
    """Summarize semantic clustering quality and whether it is final-quality eligible."""

    normalized = _l2norm(semantic_embeddings.astype(np.float32, copy=False))
    per_cluster = _per_cluster_quality(normalized, valid_clusters)
    mean_cohesion = _mean([item["cohesion"] for item in per_cluster])
    mean_nearest = _mean([item["nearestCentroidSimilarity"] for item in per_cluster])
    mean_margin = _mean([item["separationMargin"] for item in per_cluster])
    cluster_distinctiveness = _mean([item["distinctiveness"] for item in per_cluster])
    positive_margin_rate = _positive_margin_rate(per_cluster)
    silhouette_proxy = _mean([item["silhouetteProxy"] for item in per_cluster])
    final_semantic_quality = _is_final_semantic_runtime(embedding_runtime, embedding_model_name)
    status = "final_semantic_validation" if final_semantic_quality else "structure_only_embedding"
    blocking_reason = None if final_semantic_quality else "semantic_embedding_runtime_not_bge_m3"
    return {
        "schemaVersion": "semantic-quality.v1",
        "embeddingRuntime": embedding_runtime,
        "embeddingModelName": embedding_model_name,
        "embeddingSource": embedding_source,
        "finalSemanticQuality": final_semantic_quality,
        "status": status,
        "blockingReason": blocking_reason,
        "clusterCount": len(valid_clusters),
        "meanClusterCohesion": mean_cohesion,
        "meanNearestCentroidSimilarity": mean_nearest,
        "meanSeparationMargin": mean_margin,
        "clusterDistinctiveness": cluster_distinctiveness,
        "positiveMarginRate": positive_margin_rate,
        "semanticSilhouetteProxy": silhouette_proxy,
        "clusters": per_cluster,
    }


def _per_cluster_quality(vectors: np.ndarray, valid_clusters: dict[int, list[int]]) -> list[dict[str, Any]]:
    centroids = {
        cluster_id: _l2norm(vectors[indices].mean(axis=0, keepdims=True))[0]
        for cluster_id, indices in valid_clusters.items()
        if indices
    }
    rows: list[dict[str, Any]] = []
    for cluster_id, indices in sorted(valid_clusters.items()):
        if not indices or cluster_id not in centroids:
            continue
        members = vectors[indices]
        centroid = centroids[cluster_id]
        cohesion = float(np.mean(members @ centroid)) if members.size else 0.0
        nearest = _nearest_centroid_similarity(cluster_id, centroid, centroids)
        margin = cohesion - nearest if nearest is not None else cohesion
        distinctiveness = _margin_distinctiveness_score(margin)
        rows.append(
            {
                "clusterId": cluster_id,
                "memberCount": len(indices),
                "cohesion": _clip(cohesion),
                "nearestCentroidSimilarity": None if nearest is None else _clip(nearest),
                "separationMargin": _clip(margin, low=-1.0, high=1.0),
                "distinctiveness": distinctiveness,
                "silhouetteProxy": _clip((margin + 1.0) / 2.0),
            }
        )
    return rows


def _nearest_centroid_similarity(
    cluster_id: int,
    centroid: np.ndarray,
    centroids: dict[int, np.ndarray],
) -> float | None:
    similarities = [
        float(centroid @ other_centroid) for other_id, other_centroid in centroids.items() if other_id != cluster_id
    ]
    return max(similarities) if similarities else None


def _is_final_semantic_runtime(embedding_runtime: str, embedding_model_name: str) -> bool:
    runtime = embedding_runtime.strip().lower()
    model = embedding_model_name.strip().lower()
    return runtime in {"flag_embedding", "local_http"} and FINAL_SEMANTIC_MODEL_HINT in model


def _l2norm(vectors: np.ndarray) -> np.ndarray:
    values = vectors.astype(np.float32, copy=True)
    if values.size == 0:
        return values
    norms = np.linalg.norm(values, axis=1, keepdims=True)
    normalized = np.zeros_like(values, dtype=np.float32)
    _ = np.divide(values, norms, out=normalized, where=norms > 0.0)
    return normalized.astype(np.float32, copy=False)


def _mean(values: list[float | None]) -> float | None:
    numeric_values = [value for value in values if value is not None]
    if not numeric_values:
        return None
    return float(np.mean(np.asarray(numeric_values, dtype=np.float32)))


def _positive_margin_rate(rows: list[dict[str, Any]]) -> float | None:
    if not rows:
        return None
    positive_count = sum(
        1
        for row in rows
        if isinstance((value := row.get("separationMargin")), (int, float))
        and not isinstance(value, bool)
        and value > 0
    )
    return positive_count / len(rows)


def _margin_distinctiveness_score(margin: float) -> float:
    return _clip((margin + 0.02) / 0.12)


def _clip(value: float, *, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


__all__ = ["build_semantic_quality_report"]
