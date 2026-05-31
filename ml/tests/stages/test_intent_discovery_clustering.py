from __future__ import annotations

# pyright: reportMissingImports=false, reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
import numpy as np
import pytest

from pipeline.stages.intent_discovery.clustering import (
    build_hybrid_affinity_graph,
    build_knn_graph,
    combine_with_flow,
    compact_clusters_by_centroid_similarity,
    compute_centroids,
    detect_communities,
    estimate_cluster_stability,
    hdbscan_assist_summary,
    identify_outliers,
    reassign_nearby_outliers,
)
from pipeline.stages.intent_discovery.main import (
    _candidate_float_values,
    _clustering_candidate_score,
    _ClusteringCandidateResult,
    _guarded_clustering_selection,
    _semantic_variant_score,
)
from pipeline.stages.preprocessing.types import FLOW_SIGNATURE_DIM, ProcessedConversation


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


def test_hybrid_affinity_graph_uses_flow_signal() -> None:
    embeddings = np.array(
        [
            [1.0, 0.0],
            [0.95, 0.05],
            [1.0, 0.0],
            [0.95, 0.05],
        ],
        dtype=np.float32,
    )
    flow_signatures = np.zeros((4, FLOW_SIGNATURE_DIM), dtype=np.float32)
    flow_signatures[0, 0] = 1.0
    flow_signatures[1, 0] = 1.0
    flow_signatures[2, 1] = 1.0
    flow_signatures[3, 1] = 1.0

    graph = build_hybrid_affinity_graph(embeddings, flow_signatures, k=1, flow_weight=0.9)

    edges = {tuple(sorted(edge.tuple)) for edge in graph.es}
    assert (0, 1) in edges
    assert (2, 3) in edges


def test_hybrid_affinity_graph_validates_inputs() -> None:
    embeddings = np.zeros((2, 3), dtype=np.float32)
    flow_signatures = np.zeros((3, FLOW_SIGNATURE_DIM), dtype=np.float32)

    with pytest.raises(ValueError, match="same row count"):
        build_hybrid_affinity_graph(embeddings, flow_signatures)
    with pytest.raises(ValueError, match="flow_weight"):
        build_hybrid_affinity_graph(embeddings, None, flow_weight=1.5)
    with pytest.raises(ValueError, match="non_mutual"):
        build_hybrid_affinity_graph(embeddings, None, non_mutual_keep_quantile=1.5)


def test_estimate_cluster_stability_reports_mean_score() -> None:
    embeddings = np.array(
        [
            [1.0, 0.0],
            [0.98, 0.02],
            [0.0, 1.0],
            [0.02, 0.98],
        ],
        dtype=np.float32,
    )
    flow_signatures = np.zeros((4, FLOW_SIGNATURE_DIM), dtype=np.float32)
    flow_signatures[:2, 0] = 1.0
    flow_signatures[2:, 1] = 1.0

    summary = estimate_cluster_stability(
        embeddings,
        flow_signatures,
        {0: [0, 1], 1: [2, 3]},
        k_values=(1,),
        resolution_values=(1.0,),
        flow_weights=(0.2,),
        seeds=(1,),
    )

    assert summary["clusterStabilityRunCount"] == 1
    assert isinstance(summary["clusterStability"], float)
    assert summary["clusterStabilityByCluster"]


def test_hdbscan_assist_summary_handles_small_input() -> None:
    summary = hdbscan_assist_summary(np.zeros((1, 2), dtype=np.float32), {}, min_cluster_size=3)

    assert summary["hdbscanAvailable"] is False
    assert summary["hdbscanReason"] == "insufficient_rows"
    assert summary["hdbscanSplitCandidateCount"] == 0


def test_reassign_nearby_outliers_uses_similarity_and_frame_evidence() -> None:
    embeddings = np.array(
        [
            [1.0, 0.0],
            [0.98, 0.02],
            [0.0, 1.0],
            [0.02, 0.98],
            [0.96, 0.04],
            [0.70, 0.70],
        ],
        dtype=np.float32,
    )
    conversations = [_conversation(index, "요금 확인", "요금", "확인") for index in range(6)]

    outliers, clusters, report = reassign_nearby_outliers(
        {0: [0, 1], 1: [2, 3]},
        {4, 5},
        embeddings,
        conversations,
        min_similarity=0.72,
    )

    assert 4 not in outliers
    assert 4 in clusters[0]
    assert 5 in outliers
    assert report["outlierReassignmentCount"] == 1


def test_reassign_nearby_outliers_keeps_ungrounded_strong_matches_as_outliers() -> None:
    embeddings = np.array(
        [
            [1.0, 0.0],
            [0.99, 0.01],
            [0.0, 1.0],
            [0.01, 0.99],
            [0.80, 0.60],
        ],
        dtype=np.float32,
    )
    conversations = [_conversation(index, "요금 확인", "요금", "확인") for index in range(5)]
    conversations[4].metadata["actionObjectFrame"] = {
        "object": "",
        "action": "확인",
        "confidence": 0.6,
        "objectQuality": 0.0,
    }

    outliers, clusters, report = reassign_nearby_outliers(
        {0: [0, 1], 1: [2, 3]},
        {4},
        embeddings,
        conversations,
        strong_similarity=0.80,
        min_similarity=0.72,
    )

    assert 4 in outliers
    assert 4 not in clusters[0]
    assert report["outlierReassignmentCount"] == 0


def test_compact_clusters_by_centroid_similarity_merges_nearby_clusters() -> None:
    embeddings = np.array(
        [
            [1.0, 0.0],
            [0.99, 0.01],
            [0.98, 0.02],
            [0.97, 0.03],
            [0.0, 1.0],
            [0.01, 0.99],
        ],
        dtype=np.float32,
    )

    compacted, report = compact_clusters_by_centroid_similarity(
        {10: [0, 1], 20: [2, 3], 30: [4, 5]},
        embeddings,
        similarity_threshold=0.95,
    )

    assert len(compacted) == 2
    assert sorted(len(members) for members in compacted.values()) == [2, 4]
    assert report["clusterCompactionMergedClusterCount"] == 1
    assert report["clusterCompactionMergeEdgeCount"] >= 1


def test_compact_clusters_respects_distinct_hdbscan_dense_groups() -> None:
    embeddings = np.array(
        [
            [1.0, 0.0],
            [0.99, 0.01],
            [0.98, 0.02],
            [0.97, 0.03],
        ],
        dtype=np.float32,
    )

    compacted, report = compact_clusters_by_centroid_similarity(
        {10: [0, 1], 20: [2, 3]},
        embeddings,
        similarity_threshold=0.95,
        hdbscan_labels=[1, 1, 2, 2],
        hdbscan_override_similarity=1.0,
    )

    assert len(compacted) == 2
    assert report["clusterCompactionBlockedByHdbscanCount"] >= 1


def test_semantic_variant_score_rewards_margin_and_stability() -> None:
    weak_score = _semantic_variant_score(
        {
            "clusterDistinctiveness": 0.05,
            "positiveMarginRate": 0.1,
            "meanSeparationMargin": -0.04,
        },
        stability_value=0.4,
        outlier_rate=0.25,
        cluster_count=3,
        min_cluster_count=6,
    )
    strong_score = _semantic_variant_score(
        {
            "clusterDistinctiveness": 0.42,
            "positiveMarginRate": 0.7,
            "meanSeparationMargin": 0.04,
        },
        stability_value=0.8,
        outlier_rate=0.05,
        cluster_count=6,
        min_cluster_count=6,
    )

    assert strong_score > weak_score


def test_candidate_float_values_are_bounded_and_unique() -> None:
    values = _candidate_float_values(0.75, offsets=(0.0, 0.05, 0.05, 0.20), low=0.45, high=0.78)

    assert values == (0.75, 0.78)


def test_clustering_candidate_score_prefers_clearer_boundary_without_domain_terms() -> None:
    weak_score = _clustering_candidate_score(
        {
            "clusterDistinctiveness": 0.04,
            "positiveMarginRate": 0.10,
            "meanSeparationMargin": -0.05,
            "semanticSilhouetteProxy": 0.45,
        },
        same_intent_report={"nodeCount": 40, "edgeHubnessMaxDegree": 22},
        outlier_rate=0.08,
        cluster_count=5,
        min_cluster_count=4,
    )
    clearer_score = _clustering_candidate_score(
        {
            "clusterDistinctiveness": 0.30,
            "positiveMarginRate": 0.55,
            "meanSeparationMargin": 0.01,
            "semanticSilhouetteProxy": 0.55,
        },
        same_intent_report={"nodeCount": 40, "edgeHubnessMaxDegree": 8},
        outlier_rate=0.12,
        cluster_count=6,
        min_cluster_count=4,
    )
    fragmented_score = _clustering_candidate_score(
        {
            "clusterDistinctiveness": 0.45,
            "positiveMarginRate": 0.70,
            "meanSeparationMargin": 0.05,
            "semanticSilhouetteProxy": 0.60,
        },
        same_intent_report={"nodeCount": 40, "edgeHubnessMaxDegree": 3},
        outlier_rate=0.55,
        cluster_count=2,
        min_cluster_count=4,
    )

    assert clearer_score > weak_score
    assert clearer_score > fragmented_score


def test_clustering_candidate_score_penalizes_coarse_cluster_collapse() -> None:
    coarse_score = _clustering_candidate_score(
        {
            "clusterDistinctiveness": 0.14,
            "positiveMarginRate": 0.12,
            "meanSeparationMargin": -0.055,
            "semanticSilhouetteProxy": 0.47,
        },
        same_intent_report={"nodeCount": 180, "edgeHubnessMaxDegree": 26},
        outlier_rate=0.11,
        cluster_count=8,
        min_cluster_count=4,
    )
    diverse_score = _clustering_candidate_score(
        {
            "clusterDistinctiveness": 0.11,
            "positiveMarginRate": 0.18,
            "meanSeparationMargin": -0.067,
            "semanticSilhouetteProxy": 0.46,
        },
        same_intent_report={"nodeCount": 180, "edgeHubnessMaxDegree": 26},
        outlier_rate=0.08,
        cluster_count=11,
        min_cluster_count=4,
    )

    assert diverse_score > coarse_score


def test_guarded_clustering_selection_keeps_baseline_for_tiny_noisy_gain() -> None:
    baseline = _candidate_result(score=0.24, distinctiveness=0.05, outlier_rate=0.08)
    tiny_gain = _candidate_result(score=0.247, distinctiveness=0.04, outlier_rate=0.05)

    selected, reason = _guarded_clustering_selection(baseline, tiny_gain)

    assert selected is baseline
    assert reason == "baseline_guard_score_gain"


def test_guarded_clustering_selection_accepts_meaningful_generic_gain() -> None:
    baseline = _candidate_result(score=0.24, distinctiveness=0.05, outlier_rate=0.08)
    better = _candidate_result(score=0.28, distinctiveness=0.07, outlier_rate=0.12)

    selected, reason = _guarded_clustering_selection(baseline, better)

    assert selected is better
    assert reason == "candidate_score_gain"


def _candidate_result(
    *,
    score: float,
    distinctiveness: float,
    outlier_rate: float,
) -> _ClusteringCandidateResult:
    return _ClusteringCandidateResult(
        same_intent_threshold=0.55,
        leiden_resolution=1.6,
        memberships=[],
        outlier_node_indices=set(),
        valid_clusters={},
        hdbscan_summary={},
        hdbscan_refinement={},
        safe_merge_report={},
        outlier_reassignment_report={},
        same_intent_report={},
        selection_report={
            "score": score,
            "clusterDistinctiveness": distinctiveness,
            "outlierRate": outlier_rate,
        },
    )


def _conversation(index: int, text: str, object_term: str, action: str) -> ProcessedConversation:
    return ProcessedConversation(
        id=f"c{index}",
        dataset_id="ds",
        canonical_text=text,
        customer_problem_text=text,
        flow_signature=tuple([0.0] * FLOW_SIGNATURE_DIM),
        flow_signature_dim=FLOW_SIGNATURE_DIM,
        turn_count=2,
        customer_turn_count=1,
        pii_mask_count=0,
        filtered=False,
        workflow_signal={},
        metadata={
            "actionObjectFrame": {
                "object": object_term,
                "action": action,
                "confidence": 0.9,
                "objectQuality": 0.8,
            }
        },
    )
