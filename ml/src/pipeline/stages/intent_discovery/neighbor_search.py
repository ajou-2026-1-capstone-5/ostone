from __future__ import annotations

import math
import os

import numpy as np


def knn_n_jobs() -> int:
    value = os.getenv("PIPELINE_KNN_N_JOBS", "1").strip()
    try:
        parsed = int(value)
    except ValueError:
        return 1
    return parsed if parsed != 0 else 1


def neighbor_search_vectors(vectors: np.ndarray) -> np.ndarray:
    normalized = l2norm(vectors.astype(np.float32, copy=False))
    min_inputs = positive_int_env("PIPELINE_KNN_PROJECTION_MIN_INPUTS", 5000)
    target_dims = positive_int_env("PIPELINE_KNN_PROJECTION_DIMS", 8)
    if normalized.shape[0] <= min_inputs or normalized.shape[1] <= target_dims:
        return normalized
    rng = np.random.default_rng(17)
    projection = rng.normal(
        loc=0.0,
        scale=1.0 / math.sqrt(float(target_dims)),
        size=(normalized.shape[1], target_dims),
    ).astype(np.float32)
    return l2norm(normalized @ projection)


def batched_top_neighbors(vectors: np.ndarray, neighbor_count: int) -> tuple[np.ndarray, np.ndarray]:
    node_count = int(vectors.shape[0])
    if node_count == 0 or neighbor_count <= 0:
        return (
            np.zeros((node_count, 0), dtype=np.int64),
            np.zeros((node_count, 0), dtype=np.float32),
        )
    window_min_inputs = positive_int_env("PIPELINE_KNN_WINDOW_MIN_INPUTS", 5000)
    if node_count > window_min_inputs:
        return _window_top_neighbors(vectors, neighbor_count)
    search_count = min(neighbor_count, node_count - 1)
    batch_size = positive_int_env("PIPELINE_KNN_BATCH_SIZE", 2048)
    indices = np.zeros((node_count, search_count), dtype=np.int64)
    scores = np.zeros((node_count, search_count), dtype=np.float32)
    for start in range(0, node_count, batch_size):
        end = min(start + batch_size, node_count)
        similarities = (vectors[start:end] @ vectors.T).astype(np.float32, copy=False)
        row_indices = np.arange(end - start)
        similarities[row_indices, np.arange(start, end)] = -np.inf
        candidates = np.argpartition(-similarities, kth=search_count - 1, axis=1)[:, :search_count]
        candidate_scores = np.take_along_axis(similarities, candidates, axis=1)
        order = np.argsort(-candidate_scores, axis=1, kind="stable")
        indices[start:end] = np.take_along_axis(candidates, order, axis=1)
        scores[start:end] = np.take_along_axis(candidate_scores, order, axis=1)
    return indices, np.clip(scores, 0.0, 1.0)


def local_scale_from_scores(neighbor_scores: np.ndarray) -> np.ndarray:
    if neighbor_scores.shape[1] == 0:
        return np.full((neighbor_scores.shape[0],), 1e-3, dtype=np.float32)
    kth_scores = neighbor_scores[:, -1]
    return np.maximum(1e-3, 1.0 - kth_scores).astype(np.float32, copy=False)


def positive_int_env(key: str, default: int) -> int:
    value = os.getenv(key, "").strip()
    if not value:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def l2norm(vectors: np.ndarray) -> np.ndarray:
    values = vectors.astype(np.float32, copy=True)
    norms = np.linalg.norm(values, axis=1, keepdims=True)
    normalized = np.zeros_like(values, dtype=np.float32)
    _ = np.divide(values, norms, out=normalized, where=norms > 0.0)
    return normalized.astype(np.float32, copy=False)


def _window_top_neighbors(vectors: np.ndarray, neighbor_count: int) -> tuple[np.ndarray, np.ndarray]:
    node_count = int(vectors.shape[0])
    search_count = min(neighbor_count, node_count - 1)
    window_size = positive_int_env("PIPELINE_KNN_WINDOW_SIZE", max(32, search_count * 3))
    candidate_sets: list[set[int]] = [set() for _ in range(node_count)]
    for dimension in range(vectors.shape[1]):
        order = np.argsort(vectors[:, dimension], kind="stable")
        for position, source in enumerate(order):
            start = max(0, position - window_size)
            end = min(node_count, position + window_size + 1)
            candidate_sets[int(source)].update(int(target) for target in order[start:end] if target != source)

    indices = np.zeros((node_count, search_count), dtype=np.int64)
    scores = np.full((node_count, search_count), -np.inf, dtype=np.float32)
    for source, candidates in enumerate(candidate_sets):
        if not candidates:
            continue
        candidate_indices = np.asarray(sorted(candidates), dtype=np.int64)
        candidate_scores = (vectors[source] @ vectors[candidate_indices].T).astype(np.float32, copy=False)
        take_count = min(search_count, int(candidate_indices.shape[0]))
        top_positions = np.argpartition(-candidate_scores, kth=take_count - 1)[:take_count]
        top_scores = candidate_scores[top_positions]
        order = np.argsort(-top_scores, kind="stable")
        selected_positions = top_positions[order]
        indices[source, :take_count] = candidate_indices[selected_positions]
        scores[source, :take_count] = candidate_scores[selected_positions]
        if take_count < search_count:
            indices[source, take_count:] = source
    return indices, np.clip(scores, 0.0, 1.0)
