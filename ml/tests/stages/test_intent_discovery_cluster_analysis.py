from __future__ import annotations

# pyright: reportMissingTypeStubs=false, reportPrivateUsage=false
import numpy as np

from pipeline.stages.intent_discovery.cluster_analysis import (
    _exemplar_indices,
    _novel_intent_candidates,
    _top_keywords,
    _workflow_signal,
    build_cluster_results,
)
from pipeline.stages.intent_discovery.clustering import compute_centroids
from pipeline.stages.intent_discovery.types import WORKFLOW_SIGNAL_KEYS
from pipeline.stages.preprocessing.types import FLOW_SIGNATURE_DIM, ProcessedConversation


def test_should_build_cluster_results_and_novel_candidates() -> None:
    conversations = [
        _processed_conversation(0, "결제 환불 요청", "resolved", "chat"),
        _processed_conversation(1, "결제 환급 문의", "resolved", "chat"),
        _processed_conversation(2, "payment refund help", "resolved", "chat"),
        _processed_conversation(3, "본인인증 identity 확인", "escalated", "email"),
        _processed_conversation(4, "휴대폰 인증 identity 문제", "escalated", "email"),
        _processed_conversation(5, "本人인증 절차 문의", "escalated", "email"),
        _processed_conversation(6, "새로운 요청 1", "unknown", "chat"),
        _processed_conversation(7, "새로운 요청 2", "unknown", "chat"),
        _processed_conversation(8, "새로운 요청 3", "unknown", "chat"),
        _processed_conversation(9, "새로운 요청 4", "unknown", "chat"),
        _processed_conversation(10, "새로운 요청 5", "unknown", "chat"),
    ]
    vectors = np.array(
        [
            [1.00, 0.00, 0.00],
            [0.98, 0.02, 0.00],
            [0.96, 0.04, 0.00],
            [0.00, 1.00, 0.00],
            [0.02, 0.98, 0.00],
            [0.04, 0.96, 0.00],
            [0.00, 0.00, 1.00],
            [0.00, 0.00, 0.98],
            [0.00, 0.00, 0.96],
            [0.01, 0.00, 0.95],
            [0.02, 0.00, 0.94],
        ],
        dtype=np.float32,
    )
    valid_clusters = {10: [0, 1, 2], 20: [3, 4, 5]}
    centroids = compute_centroids(vectors, valid_clusters)

    clusters, novel_candidates = build_cluster_results(
        valid_clusters,
        {6, 7, 8, 9, 10},
        conversations,
        vectors,
        centroids,
    )

    assert len(clusters) == 2
    assert [cluster.cluster_id for cluster in clusters] == [10, 20]
    assert all(len(cluster.exemplar_indices) >= 1 for cluster in clusters)
    assert all(len(cluster.keywords) >= 1 for cluster in clusters)
    assert all(cluster.suggested_name for cluster in clusters)
    assert all(set(WORKFLOW_SIGNAL_KEYS) == set(cluster.workflow_signal) for cluster in clusters)
    assert clusters[0].workflow_signal["requires_payment_check"] is True
    assert clusters[1].workflow_signal["requires_user_identification"] is True
    assert clusters[1].workflow_signal["has_escalation_cases"] is True
    assert len(novel_candidates) == 1
    assert novel_candidates[0].candidate_key == "outlier_status:unknown:5"
    assert novel_candidates[0].candidate_size == 5
    assert novel_candidates[0].member_conv_ids == ("c6", "c7", "c8", "c9", "c10")


def test_should_pick_top_two_exemplars_by_cosine_similarity() -> None:
    vectors = np.array(
        [
            [1.0, 0.0],
            [0.9, 0.1],
            [0.0, 1.0],
        ],
        dtype=np.float32,
    )

    exemplar_indices = _exemplar_indices([0, 1, 2], np.array([1.0, 0.0], dtype=np.float32), vectors)

    assert exemplar_indices == (0, 1)


def test_should_extract_keywords_from_canonical_text() -> None:
    conversations = [
        _processed_conversation(0, "환불 결제 환불", "resolved", "chat"),
        _processed_conversation(1, "환불 payment refund", "resolved", "chat"),
    ]

    keywords = _top_keywords([0, 1], conversations, top_k=2)

    assert len(keywords) == 2
    assert all(isinstance(keyword, str) for keyword in keywords)


def test_should_detect_workflow_signal_flags() -> None:
    conversations = [
        _processed_conversation(0, "결제 환불", "resolved", "chat"),
        _processed_conversation(1, "휴대폰 인증", "escalated", "chat"),
    ]

    workflow_signal = _workflow_signal([0, 1], conversations)

    assert workflow_signal == {
        "requires_payment_check": True,
        "requires_user_identification": True,
        "has_escalation_cases": True,
    }


def test_should_skip_small_outlier_groups_for_novel_candidates() -> None:
    conversations = [_processed_conversation(index, "기타 문의", "unknown", "chat") for index in range(4)]

    candidates = _novel_intent_candidates(conversations, {0, 1, 2, 3})

    assert candidates == []


def _processed_conversation(
    index: int,
    canonical_text: str,
    ended_status: str | None,
    channel: str | None,
) -> ProcessedConversation:
    return ProcessedConversation(
        id=f"c{index}",
        dataset_id="ds1",
        channel=channel,
        ended_status=ended_status,
        canonical_text=canonical_text,
        customer_problem_text=canonical_text,
        flow_signature=tuple([0.0] * FLOW_SIGNATURE_DIM),
        flow_signature_dim=FLOW_SIGNATURE_DIM,
        turn_count=2,
        customer_turn_count=1,
        pii_mask_count=0,
        filtered=False,
    )
