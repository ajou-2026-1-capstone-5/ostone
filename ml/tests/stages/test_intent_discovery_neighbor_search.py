from __future__ import annotations

import numpy as np
import pytest

from pipeline.stages.intent_discovery.neighbor_search import (
    batched_top_neighbors,
    knn_n_jobs,
    local_scale_from_scores,
    neighbor_search_vectors,
    positive_int_env,
)


def test_batched_top_neighbors_returns_sorted_neighbors(monkeypatch) -> None:
    monkeypatch.setenv("PIPELINE_KNN_BATCH_SIZE", "2")
    vectors = np.array(
        [
            [1.0, 0.0],
            [0.9, 0.1],
            [0.0, 1.0],
        ],
        dtype=np.float32,
    )

    indices, scores = batched_top_neighbors(vectors, 1)

    assert indices.tolist() == [[1], [0], [1]]
    assert scores.shape == (3, 1)
    assert scores[0, 0] > scores[2, 0]


def test_batched_top_neighbors_uses_window_mode_for_large_inputs(monkeypatch) -> None:
    monkeypatch.setenv("PIPELINE_KNN_WINDOW_MIN_INPUTS", "2")
    monkeypatch.setenv("PIPELINE_KNN_WINDOW_SIZE", "1")
    vectors = np.eye(4, dtype=np.float32)

    indices, scores = batched_top_neighbors(vectors, 2)

    assert indices.shape == (4, 2)
    assert scores.shape == (4, 2)
    assert np.all(scores >= 0.0)


def test_neighbor_search_vectors_projects_large_high_dimensional_inputs(monkeypatch) -> None:
    monkeypatch.setenv("PIPELINE_KNN_PROJECTION_MIN_INPUTS", "2")
    monkeypatch.setenv("PIPELINE_KNN_PROJECTION_DIMS", "3")
    vectors = np.ones((3, 5), dtype=np.float32)

    projected = neighbor_search_vectors(vectors)

    assert projected.shape == (3, 3)


def test_neighbor_search_env_helpers(monkeypatch) -> None:
    monkeypatch.setenv("PIPELINE_KNN_N_JOBS", "0")
    monkeypatch.setenv("PIPELINE_KNN_WINDOW_SIZE", "bad")

    assert knn_n_jobs() == 1
    assert positive_int_env("PIPELINE_KNN_WINDOW_SIZE", 7) == 7
    assert local_scale_from_scores(np.array([[0.8], [1.0]], dtype=np.float32)).tolist() == pytest.approx([0.2, 0.001])
