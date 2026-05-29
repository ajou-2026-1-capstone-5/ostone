from __future__ import annotations

# pyright: reportMissingTypeStubs=false, reportPrivateUsage=false
import numpy as np

from pipeline.stages.intent_discovery.cluster_analysis import (
    _clean_keyword,
    _exemplar_indices,
    _label_candidates,
    _label_terms,
    _novel_intent_candidates,
    _rerank_label_candidates,
    _score_label,
    _suggested_name,
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
        _processed_conversation(4, "인증 identity 문제", "escalated", "email"),
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
    assert all(len(cluster.exemplar_conv_ids) >= 1 for cluster in clusters)
    assert all(len(cluster.keywords) >= 1 for cluster in clusters)
    assert all(cluster.suggested_name.endswith("문의") for cluster in clusters)
    assert all(set(WORKFLOW_SIGNAL_KEYS) == set(cluster.workflow_signal) for cluster in clusters)
    assert clusters[0].workflow_signal["requires_payment_check"] is True
    assert clusters[1].workflow_signal["requires_user_identification"] is True
    assert clusters[1].workflow_signal["has_escalation_cases"] is True
    assert len(novel_candidates) == 1
    assert novel_candidates[0].candidate_key == "outlier_status:unknown:5"
    assert novel_candidates[0].member_conv_ids == ("c6", "c7", "c8", "c9", "c10")


def test_should_pick_top_three_exemplars_as_conv_ids_by_cosine_similarity() -> None:
    vectors = np.array(
        [
            [1.0, 0.0],
            [0.9, 0.1],
            [0.0, 1.0],
        ],
        dtype=np.float32,
    )
    conversations = [
        _processed_conversation(0, "text0", "resolved", "chat"),
        _processed_conversation(1, "text1", "resolved", "chat"),
        _processed_conversation(2, "text2", "resolved", "chat"),
    ]

    exemplar_conv_ids = _exemplar_indices([0, 1, 2], np.array([1.0, 0.0], dtype=np.float32), vectors, conversations)

    assert exemplar_conv_ids == ("c0", "c1", "c2")
    assert all(isinstance(cid, str) for cid in exemplar_conv_ids)
    assert len(exemplar_conv_ids) <= 3


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
        _processed_conversation(1, "본인 인증", "escalated", "chat"),
    ]

    workflow_signal = _workflow_signal([0, 1], conversations)

    assert workflow_signal == {
        "requires_payment_check": True,
        "requires_user_identification": True,
        "has_escalation_cases": True,
    }


def test_should_name_cluster_from_unsupervised_keywords_without_operator_category_metadata() -> None:
    assert _suggested_name(3, [], [], ("납부", "방법", "고객")) == "납부 / 방법 문의"
    assert _suggested_name(4, [], [], ()) == "미분류_4"
    assert _label_terms(("문의", "처리", "금액")) == ("처리", "금액")


def test_should_normalize_low_value_label_terms_without_domain_lexicon() -> None:
    assert _clean_keyword("변경할") == "변경"
    assert _clean_keyword("결제해") == "결제"
    assert _clean_keyword("취소할려구요") == "취소"
    assert _clean_keyword("드렸어요") == ""
    assert _clean_keyword("상담하신") == ""
    assert _clean_keyword("분은") == ""
    assert _clean_keyword("얼마죠") == "금액"
    assert _clean_keyword("인출해가시면") == "출금"
    assert _clean_keyword("초과돼") == "초과"
    assert _clean_keyword("원으로") == ""
    assert _clean_keyword("카드번호") == ""
    assert _clean_keyword("하려구요") == ""
    assert _clean_keyword("것만") == ""
    assert _clean_keyword("얼만지") == "금액"
    assert _clean_keyword("확인하니까") == ""
    assert _clean_keyword("되게끔") == ""
    assert _clean_keyword("오르겠죠") == ""
    assert _clean_keyword("모르겠네") == ""
    assert _clean_keyword("말을") == ""
    assert _clean_keyword("있을까") == ""
    assert _clean_keyword("뭐예") == ""
    assert _clean_keyword("좋고") == ""
    assert _clean_keyword("사는") == ""
    assert _clean_keyword("정보들") == ""
    assert _clean_keyword("있다고") == ""
    assert _clean_keyword("왔었는데") == ""
    assert _clean_keyword("바꾸긴") == ""
    assert _clean_keyword("잘된") == ""
    assert _clean_keyword("품목별") == ""
    assert _clean_keyword("간단하게") == ""
    assert _clean_keyword("보내주시겠어") == ""
    assert _clean_keyword("어저께") == ""
    assert _clean_keyword("요청해가지고") == ""
    assert _clean_keyword("그래가지고") == ""
    assert _clean_keyword("같은데") == ""
    assert _clean_keyword("만들") == ""
    assert _clean_keyword("전에") == ""
    assert _clean_keyword("나간다") == ""
    assert _label_terms(("서비스 변경", "변경할", "그냥", "데이터")) == ("서비스 변경", "데이터")
    assert _label_terms(("선결제", "결제해", "뭐지")) == ("선결제",)


def test_label_reranker_prefers_evidence_grounded_readable_candidate() -> None:
    conversations = [
        _processed_conversation(0, "고객이 결제 환불 가능 여부를 문의", "resolved", "chat"),
        _processed_conversation(1, "결제 환불 규정 안내", "resolved", "chat"),
    ]

    result = _rerank_label_candidates(1, [0, 1], conversations, ("결제 환불", "가능 여부", "문의"))

    assert result["name"] == "결제 환불 문의"
    assert result["status"] == "auto_acceptable"
    assert isinstance(result["score"], float)
    assert result["score"] >= 0.65


def test_label_score_penalizes_unreadable_or_ungrounded_label() -> None:
    score = _score_label("가능 여부 / 기타 문의", "결제 환불 규정 안내", ["결제 환불 규정 안내"], ("결제", "환불"))

    assert score["score"] < 0.65
    assert score["evidenceCoverage"] == 0.0


def test_label_reranker_uses_action_object_frame_candidate() -> None:
    conversations = [
        _processed_conversation(
            0,
            "요금 확인 문의",
            "resolved",
            "chat",
            action_object_frame={"object": "요금", "action": "확인", "confidence": 0.9},
        ),
        _processed_conversation(
            1,
            "요금 내역 확인 요청",
            "resolved",
            "chat",
            action_object_frame={"object": "요금", "action": "확인", "confidence": 0.8},
        ),
    ]

    result = _rerank_label_candidates(1, [0, 1], conversations, ("확인", "문의"))
    candidates = result["candidates"]

    assert result["name"] == "요금 확인 문의"
    assert isinstance(candidates, list)
    assert isinstance(candidates[0], dict)
    assert candidates[0]["source"] == "action_object_frame"


def test_label_reranker_does_not_promote_singleton_action_object_frame() -> None:
    conversations = [
        _processed_conversation(
            0,
            "왕복 픽업 가능 여부 확인",
            "resolved",
            "chat",
            action_object_frame={"object": "왕복 픽업", "action": "가능여부확인", "confidence": 0.9},
        ),
        _processed_conversation(1, "호텔 요금 문의", "resolved", "chat"),
        _processed_conversation(2, "일정 가격 문의", "resolved", "chat"),
        _processed_conversation(3, "예약 조건 문의", "resolved", "chat"),
    ]

    result = _rerank_label_candidates(1, [0, 1, 2, 3], conversations, ("픽업", "요금", "일정"))
    candidates = result["candidates"]

    assert isinstance(candidates, list)
    assert all(candidate["source"] != "action_object_frame" for candidate in candidates)
    assert result["name"] != "왕복 픽업 가능여부확인 문의"


def test_label_reranker_filters_procedural_object_frame_terms() -> None:
    conversations = [
        _processed_conversation(
            0,
            "예약 날짜와 조건 문의",
            "resolved",
            "chat",
            action_object_frame={"object": "아직 미정 상태이겠으나", "action": "예약", "confidence": 0.9},
        ),
        _processed_conversation(
            1,
            "예약 가능 조건 확인",
            "resolved",
            "chat",
            action_object_frame={"object": "아직 미정 상태이겠으나", "action": "예약", "confidence": 0.8},
        ),
    ]

    result = _rerank_label_candidates(1, [0, 1], conversations, ("예약", "조건"))
    candidates = result["candidates"]
    name = result["name"]

    assert isinstance(candidates, list)
    assert isinstance(name, str)
    assert all(candidate["source"] != "action_object_frame" for candidate in candidates)
    assert "아직" not in name
    assert "미정" not in name


def test_label_reranker_removes_decision_discourse_terms_from_object_frame() -> None:
    conversations = [
        _processed_conversation(
            0,
            "서비스 상품 예약 문의",
            "resolved",
            "chat",
            action_object_frame={"object": "서비스 상품 하기로 할게", "action": "예약", "confidence": 0.9},
        ),
        _processed_conversation(
            1,
            "서비스 상품 예약 조건 확인",
            "resolved",
            "chat",
            action_object_frame={"object": "서비스 상품 하기로 할게", "action": "예약", "confidence": 0.8},
        ),
    ]

    result = _rerank_label_candidates(1, [0, 1], conversations, ("서비스 상품", "예약"))

    assert result["name"] == "서비스 상품 예약 문의"


def test_label_candidates_combine_dominant_action_with_cluster_keywords() -> None:
    conversations = [
        _processed_conversation(
            0,
            "요금 확인 문의",
            "resolved",
            "chat",
            action_object_frame={"object": "요금", "action": "확인", "confidence": 0.9},
        ),
        _processed_conversation(
            1,
            "청구 금액 확인 문의",
            "resolved",
            "chat",
            action_object_frame={"object": "청구 금액", "action": "확인", "confidence": 0.9},
        ),
        _processed_conversation(2, "납부 내역 확인 문의", "resolved", "chat"),
    ]

    candidates = _label_candidates(1, [0, 1, 2], conversations, ("요금", "청구 금액", "문의"), None)

    assert {"name": "요금 확인 문의", "source": "dominant_action_keyword"} in candidates


def test_label_candidates_do_not_promote_action_phrase_as_object_action() -> None:
    candidates = _label_candidates(
        1,
        [],
        [],
        ("예약 연락", "예약 정보", "요청드렸는데 견적", "예약 있을까", "견적", "호텔"),
        None,
    )

    names = [candidate["name"] for candidate in candidates]
    assert "예약 연락 문의" not in names
    assert "예약 정보 문의" not in names
    assert "요청드렸는데 견적 문의" not in names
    assert "있을까 예약 문의" not in names
    assert "예약 문의" in names
    assert "견적 문의" in names


def test_should_skip_small_outlier_groups_for_novel_candidates() -> None:
    conversations = [_processed_conversation(index, "기타 문의", "unknown", "chat") for index in range(2)]

    candidates = _novel_intent_candidates(conversations, {0, 1})

    assert candidates == []


def test_novel_candidates_group_by_action_object_frame_before_status() -> None:
    conversations = [
        _processed_conversation(
            0,
            "요금 확인 문의",
            "unknown",
            "chat",
            {"object": "요금", "action": "확인", "confidence": 0.9},
        ),
        _processed_conversation(
            1,
            "요금 내역 확인",
            "unknown",
            "chat",
            {"object": "요금", "action": "확인", "confidence": 0.8},
        ),
        _processed_conversation(
            2,
            "요금 다시 확인",
            "unknown",
            "chat",
            {"object": "요금", "action": "확인", "confidence": 0.7},
        ),
    ]

    candidates = _novel_intent_candidates(conversations, {0, 1, 2})

    assert len(candidates) == 1
    assert candidates[0].source_type == "outlier_frame"
    assert candidates[0].candidate_key == "outlier_frame:요금:확인:3"
    assert candidates[0].suggested_name == "요금 확인 문의"


def test_novel_candidates_back_off_to_flow_when_specific_frames_are_too_sparse() -> None:
    conversations = [
        _processed_conversation(
            0,
            "첫 번째 요청",
            "unknown",
            "chat",
            {"object": "A", "action": "확인", "confidence": 0.9},
            flow_events=("확인질문", "정책안내"),
        ),
        _processed_conversation(
            1,
            "두 번째 요청",
            "unknown",
            "chat",
            {"object": "B", "action": "확인", "confidence": 0.9},
            flow_events=("확인질문", "정책안내", "확인질문"),
        ),
        _processed_conversation(
            2,
            "세 번째 요청",
            "unknown",
            "chat",
            {"object": "C", "action": "확인", "confidence": 0.9},
            flow_events=("확인질문", "정책안내"),
        ),
    ]

    candidates = _novel_intent_candidates(conversations, {0, 1, 2})

    assert len(candidates) == 1
    assert candidates[0].source_type == "outlier_flow"
    assert candidates[0].candidate_key == "outlier_flow:확인질문>정책안내:3"


def test_score_label_supports_canonical_action_aliases() -> None:
    score = _score_label(
        "카드 사용 가능여부확인 문의",
        "카드를 사용할 수 있나요? 카드 사용 가능한가요?",
        ["카드를 사용할 수 있나요?", "카드 사용 가능한가요?"],
        ("카드", "사용", "가능여부확인"),
    )

    assert score["actionCoverage"] == 1.0
    assert score["objectActionJointCoverage"] == 1.0


def _processed_conversation(
    index: int,
    canonical_text: str,
    ended_status: str | None,
    channel: str | None,
    action_object_frame: dict[str, object] | None = None,
    flow_events: tuple[str, ...] = (),
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
        metadata={"actionObjectFrame": action_object_frame} if action_object_frame is not None else {},
        flow_events=flow_events,
    )
