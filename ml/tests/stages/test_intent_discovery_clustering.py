from __future__ import annotations

# pyright: reportMissingImports=false, reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
import numpy as np
import pytest

from pipeline.stages.intent_discovery.clustering import (
    build_knn_graph,
    combine_with_flow,
    compute_centroids,
    detect_communities,
    identify_outliers,
)
from pipeline.stages.preprocessing.types import FLOW_SIGNATURE_DIM


def test_should_cluster_hybrid_vectors_and_identify_outliers() -> None:
    embeddings = np.array(
        [
            [1.00, 0.00, 0.00],
            [0.98, 0.02, 0.00],
            [0.96, 0.04, 0.00],
            [0.00, 1.00, 0.00],
            [0.02, 0.98, 0.00],
            [0.04, 0.96, 0.00],
            [0.00, 0.00, 1.00],
            [0.00, 0.00, 0.95],
        ],
        dtype=np.float32,
    )
    flow_signatures = np.zeros((8, FLOW_SIGNATURE_DIM), dtype=np.float32)
    flow_signatures[:3, 0] = 1.0
    flow_signatures[3:6, 1] = 1.0
    flow_signatures[6:, 2] = 1.0

    vectors = combine_with_flow(embeddings, flow_signatures)
    graph = build_knn_graph(vectors, k=2)
    memberships = detect_communities(graph)
    outliers, valid_clusters = identify_outliers(memberships, min_size=3)
    centroids = compute_centroids(vectors, valid_clusters)

    assert vectors.shape == (8, 3 + FLOW_SIGNATURE_DIM)
    assert vectors.dtype == np.float32
    assert graph.vcount() == 8
    assert graph.ecount() > 0
    assert graph.is_directed() is False
    assert len(memberships) == 8
    assert len(valid_clusters) >= 1
    assert len(outliers) >= 1
    assert set(centroids) == set(valid_clusters)
    assert all(centroid.dtype == np.float32 for centroid in centroids.values())


def test_should_raise_when_row_count_mismatches() -> None:
    embeddings = np.zeros((2, 3), dtype=np.float32)
    flow_signatures = np.zeros((3, FLOW_SIGNATURE_DIM), dtype=np.float32)

    with pytest.raises(ValueError):
        _ = combine_with_flow(embeddings, flow_signatures)
