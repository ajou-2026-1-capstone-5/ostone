from __future__ import annotations

# pyright: reportMissingTypeStubs=false
import numpy as np

from pipeline.stages.intent_discovery.evaluation import (
    branching_explainability_score,
    interpretability_score,
    workflow_consistency_score,
)
from pipeline.stages.preprocessing.types import FLOW_SIGNATURE_DIM, ProcessedConversation


def test_should_score_identical_vectors_as_interpretable() -> None:
    vectors = np.tile(np.array([[1.0, 0.0, 0.0]], dtype=np.float32), (5, 1))

    score = interpretability_score(vectors, [0, 1, 2, 3, 4])

    assert np.isclose(score, 1.0)


def test_should_score_different_vectors_as_less_interpretable() -> None:
    vectors = np.array(
        [
            [1.0, 0.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 0.0, 1.0],
        ],
        dtype=np.float32,
    )

    score = interpretability_score(vectors, [0, 1, 2, 3, 4])

    assert score < 0.5


def test_should_score_workflow_consistency_from_status_and_channel() -> None:
    conversations = [_processed_conversation(index, ended_status="resolved", channel="chat") for index in range(5)]

    score = workflow_consistency_score(conversations, {1: [0, 1, 2, 3, 4]})

    assert score == {"avg_consistency": 1.0}


def test_should_return_none_for_single_member_branching_score() -> None:
    vectors = np.array([[1.0, 0.0, 0.0]], dtype=np.float32)

    score = branching_explainability_score(vectors, [0])

    assert score is None


def test_should_return_defaults_for_empty_inputs() -> None:
    vectors = np.zeros((0, 3), dtype=np.float32)

    assert interpretability_score(vectors, []) == 0.0
    assert branching_explainability_score(vectors, []) is None
    assert workflow_consistency_score([], {}) == {"avg_consistency": 0.0}


def test_should_return_centroid_score_for_single_member() -> None:
    vectors = np.array([[1.0, 0.0, 0.0]], dtype=np.float32)

    score = interpretability_score(vectors, [0])

    assert score == 1.0


def test_should_return_zero_when_centroid_norm_is_near_zero() -> None:
    vectors = np.zeros((3, 3), dtype=np.float32)

    score = interpretability_score(vectors, [0, 1, 2])

    assert score == 0.0


def test_should_calculate_workflow_consistency_with_none_values() -> None:
    conversations = [
        _processed_conversation(0, ended_status="resolved", channel="chat"),
        _processed_conversation(1, ended_status="resolved", channel=None),
        _processed_conversation(2, ended_status=None, channel="chat"),
        _processed_conversation(3, ended_status=None, channel=None),
    ]

    score = workflow_consistency_score(conversations, {1: [0, 1, 2, 3]})

    assert "avg_consistency" in score
    assert 0.0 <= score["avg_consistency"] <= 1.0


def test_should_return_zero_for_dominant_ratio_with_all_none() -> None:
    from pipeline.stages.intent_discovery.evaluation import _dominant_ratio

    result = _dominant_ratio([None, None, None])

    assert result == 0.0


def test_should_return_clipped_values_at_boundaries() -> None:
    from pipeline.stages.intent_discovery.evaluation import _clip_score

    assert _clip_score(-0.5) == 0.0
    assert _clip_score(1.5) == 1.0
    assert _clip_score(0.5) == 0.5


def test_should_use_provided_centroids_for_similarity() -> None:
    from pipeline.stages.intent_discovery.evaluation import _centroid_similarity_score

    vectors = np.array([[1.0, 0.0], [0.0, 1.0]], dtype=np.float32)
    centroids = {1: np.array([1.0, 0.0], dtype=np.float32), 2: np.array([0.0, 1.0], dtype=np.float32)}

    score = _centroid_similarity_score(vectors, [1, 2], centroids)
    score_without_centroids = _centroid_similarity_score(vectors, [1, 2], None)

    assert np.isclose(score, 1.0), f"Expected ~1.0 with matching centroids, got {score}"
    assert score >= score_without_centroids, "Centroid-guided score should be >= unguided"


def test_should_return_zero_when_centroids_have_zero_norm() -> None:
    from pipeline.stages.intent_discovery.evaluation import _centroid_similarity_score

    vectors = np.array([[1.0, 0.0]], dtype=np.float32)
    centroids = {1: np.array([0.0, 0.0], dtype=np.float32)}

    score = _centroid_similarity_score(vectors, [1], centroids)

    assert score == 0.0


def test_should_handle_empty_cluster_indices_with_centroids() -> None:
    from pipeline.stages.intent_discovery.evaluation import _centroid_similarity_score

    vectors = np.array([[1.0, 0.0]], dtype=np.float32)
    centroids = {1: np.array([1.0, 0.0], dtype=np.float32)}

    score = _centroid_similarity_score(vectors, [], centroids)

    assert score == 0.0


def test_should_calculate_branching_explainability() -> None:
    vectors = np.array(
        [
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float32,
    )

    score = branching_explainability_score(vectors, [0, 1, 2])

    assert score is not None
    assert 0.0 <= score <= 1.0


def _processed_conversation(index: int, ended_status: str | None, channel: str | None) -> ProcessedConversation:
    return ProcessedConversation(
        id=f"c{index}",
        dataset_id="ds1",
        channel=channel,
        ended_status=ended_status,
        canonical_text="test",
        customer_problem_text="problem",
        flow_signature=tuple([0.0] * FLOW_SIGNATURE_DIM),
        flow_signature_dim=FLOW_SIGNATURE_DIM,
        turn_count=1,
        customer_turn_count=1,
        pii_mask_count=0,
        filtered=False,
    )
