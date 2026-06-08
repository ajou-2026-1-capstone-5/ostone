from __future__ import annotations

from pipeline.stages.flow_splitting import main as flow_splitting


def test_flow_splitting_helper_branches() -> None:
    assert flow_splitting._split_name("기존 라벨", "resolved:requires_payment_check") == ("기존 라벨 - 결제확인 필요")
    assert flow_splitting._split_label("mixed_residual") == "기타 처리 흐름"
    assert flow_splitting._workflow_separability([]) == 0.0


def test_duplicate_intent_compaction_merges_members_keywords_and_quality() -> None:
    merged = flow_splitting._merge_duplicate_intent_labels(
        [
            {
                "cluster_id": 1,
                "suggested_name": "금액 확인 문의",
                "member_conv_ids": ["c1"],
                "exemplar_conv_ids": ["c1"],
                "keywords": ["금액"],
                "workflow_signal": {"fallback": True},
                "quality": {"interpretability_score": 0.8},
            },
            {
                "cluster_id": 2,
                "canonical_intent": "금액 확인 문의",
                "suggested_name": "금액 확인 문의",
                "member_conv_ids": ["c2"],
                "exemplar_conv_ids": ["c2"],
                "keywords": ["청구"],
                "workflow_signal": {"fallback": True},
                "quality": {"interpretability_score": 0.6, "workflow_consistency_score": 0.4},
            },
        ],
        {
            "c1": {"workflow_signal": {"requires_user_identification": True}},
            "c2": {"workflow_signal": {"requires_payment_check": True}},
        },
    )

    assert len(merged) == 1
    assert merged[0]["member_conv_ids"] == ["c1", "c2"]
    assert merged[0]["source_cluster_ids"] == [1, 2]
    assert merged[0]["keywords"] == ["금액", "청구"]
    assert merged[0]["workflow_signal"] == {
        "fallback": False,
        "requires_payment_check": True,
        "requires_user_identification": True,
    }
    assert merged[0]["quality"]["interpretability_score"] == 0.7


def test_drop_low_quality_clusters_removes_acknowledgement_only_groups() -> None:
    clusters, report = flow_splitting._drop_low_quality_clusters(
        [
            {"cluster_id": 1, "member_conv_ids": ["a1", "a2", "a3", "a4"]},
            {"cluster_id": 2, "member_conv_ids": ["b1", "b2", "b3", "b4"]},
        ],
        {
            "a1": {"filtered": True},
            "a2": {"filtered": True},
            "a3": {"filtered": True},
            "a4": {"filtered": True},
            "b1": {"filtered": True},
            "b2": {"filtered": False},
            "b3": {"filtered": False},
            "b4": {"filtered": False},
        },
    )

    assert [cluster["cluster_id"] for cluster in clusters] == [2]
    assert clusters[0]["low_quality_member_ratio"] == 0.25
    assert report["droppedLowQualityClusterCount"] == 1
    assert report["droppedLowQualityMemberCount"] == 4


def test_regenerated_label_prefers_action_object_frame_and_member_level_evidence() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2", "c3"],
        {
            "c1": {
                "customer_problem_text": "요금 결제 내역 확인하고 싶어요",
                "action_object_frame": {"object": "요금", "action": "확인", "confidence": 0.9},
            },
            "c2": {
                "customer_problem_text": "요금 확인 부탁드립니다",
                "action_object_frame": {"object": "요금", "action": "확인", "confidence": 0.8},
            },
            "c3": {
                "customer_problem_text": "다른 문의입니다",
                "action_object_frame": {"object": "기타", "action": "확인", "confidence": 0.6},
            },
        },
    )

    assert label["name"] == "요금 확인 문의"
    assert label["actionObjectValidity"] > 0.8
    assert label["specificity"] > 0.8
    assert not flow_splitting._split_label_auto_acceptable(label)
    assert flow_splitting._split_label_auto_acceptable(
        {
            **label,
            "name": "결제일 확인 문의",
        }
    )
    assert label["evidenceCoverage"] < 1.0
    assert label["candidates"][0]["source"] == "action_object_frame"


def test_regenerated_label_filters_procedural_action_object_frame_terms() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {
                "customer_problem_text": "예약 날짜와 조건 문의",
                "action_object_frame": {"object": "아직 미정 상태이겠으나", "action": "예약", "confidence": 0.9},
            },
            "c2": {
                "customer_problem_text": "예약 가능 조건 확인",
                "action_object_frame": {"object": "아직 미정 상태이겠으나", "action": "예약", "confidence": 0.8},
            },
        },
    )

    assert label["candidates"][0]["source"] != "action_object_frame"
    assert "아직" not in label["name"]
    assert "미정" not in label["name"]


def test_regenerated_label_removes_decision_discourse_terms_from_object_frame() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {
                "customer_problem_text": "서비스 상품 예약 문의",
                "action_object_frame": {"object": "서비스 상품 하기로 할게", "action": "예약", "confidence": 0.9},
            },
            "c2": {
                "customer_problem_text": "서비스 상품 예약 조건 확인",
                "action_object_frame": {"object": "서비스 상품 하기로 할게", "action": "예약", "confidence": 0.8},
            },
        },
    )

    assert label["name"] == "서비스 상품 예약 문의"


def test_regenerated_label_scores_compound_action_object_terms_by_token_evidence() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1"],
        {
            "c1": {
                "customer_problem_text": "항공료와 호텔비를 합친 비용도 궁금하고 예약 진행도 문의합니다",
                "action_object_frame": {
                    "object": "항공료 호텔비 합친 비용",
                    "action": "예약",
                    "confidence": 0.93,
                },
            },
        },
    )

    assert label["name"] == "항공료 호텔비 합친 비용 예약 문의"
    assert label["evidenceCoverage"] == 1.0
    assert label["candidates"][0]["source"] == "action_object_frame"


def test_regenerated_label_removes_discourse_from_action_object_phrase() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {
                "customer_problem_text": "계좌를 바꾸었는지 까먹어서 변경 문의합니다",
                "action_object_frame": {"object": "계좌 바꾸었는지 까먹어서", "action": "변경", "confidence": 0.93},
            },
            "c2": {
                "customer_problem_text": "계좌 변경 확인 부탁드립니다",
                "action_object_frame": {"object": "계좌", "action": "변경", "confidence": 0.86},
            },
        },
    )

    assert label["name"] == "계좌 변경 문의"
    assert "까먹어서" not in label["name"]
    assert "바꾸었는지" not in label["name"]


def test_split_label_terms_filter_generic_discourse_verbs() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {"customer_problem_text": "홍콩 하고 정보 보내고 예약 문의"},
            "c2": {"customer_problem_text": "홍콩 가고 예약 정보 문의"},
        },
    )

    assert "하고" not in label["name"]
    assert "보내고" not in label["name"]
    assert "정보" not in label["name"]


def test_regenerated_label_cleans_particle_suffixes() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {"customer_problem_text": "리조트의 요금도 확인하고 싶어요"},
            "c2": {"customer_problem_text": "리조트 요금 문의드립니다"},
        },
    )

    assert label["name"] == "리조트 요금 문의"
    assert "리조트의" not in label["name"]
    assert "요금도" not in label["name"]


def test_regenerated_label_penalizes_single_generic_term_when_specific_frame_exists() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {
                "customer_problem_text": "예약 보내야 하나요",
                "action_object_frame": {"object": "예약", "action": "정보확인", "confidence": 0.9},
            },
            "c2": {
                "customer_problem_text": "예약 보내야 해서 확인 부탁드립니다",
                "action_object_frame": {"object": "예약", "action": "정보확인", "confidence": 0.8},
            },
        },
    )

    assert label["name"] == "예약 정보확인 문의"
    assert "보내야" not in label["name"]


def test_split_label_terms_filter_channel_and_waiting_discourse() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {"customer_problem_text": "이메일 기다릴게요"},
            "c2": {"customer_problem_text": "메일로 보내주시면 기다릴게요"},
        },
    )

    assert "이메일" not in label["name"]
    assert "메일" not in label["name"]
    assert "기다릴게" not in label["name"]


def test_split_label_terms_filter_colloquial_discourse_noise() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2", "c3"],
        {
            "c1": {"customer_problem_text": "여쭤보려고 결제 문의드립니다"},
            "c2": {"customer_problem_text": "전화해가지고 결제 얼마입니까"},
            "c3": {"customer_problem_text": "결제 갑자기 변경됐는데 확인 부탁드립니다"},
        },
    )

    assert label["name"] in {"금액 결제 문의", "결제 변경 문의"}
    assert "여쭤" not in label["name"]
    assert "전화해가지고" not in label["name"]
    assert "갑자기" not in label["name"]


def test_regenerated_label_does_not_promote_acknowledgement_as_object() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {
                "customer_problem_text": "네 맞습니다 가상계좌 결제 문의",
                "action_object_frame": {"object": "맞습니다", "action": "결제", "confidence": 0.9},
            },
            "c2": {
                "customer_problem_text": "맞아요 가상계좌 입금 확인",
                "action_object_frame": {"object": "맞아요", "action": "결제", "confidence": 0.9},
            },
        },
    )

    assert "맞습니다" not in label["name"]
    assert "맞아요" not in label["name"]
    assert label["name"] == "가상계좌 결제 문의"
    assert label["objectActionJointCoverage"] > 0.0


def test_review_fallback_hides_internal_event_sequence_labels() -> None:
    label = {
        "name": "요청확인 기준확인 문의",
        "score": 0.2,
        "evidenceCoverage": 0.0,
        "memberEvidenceCoverage": 0.0,
        "objectCoverage": 0.0,
        "actionCoverage": 0.0,
        "objectActionJointCoverage": 0.0,
        "actionObjectValidity": 0.0,
        "candidates": [{"source": "term_frequency"}],
    }

    safe_label = flow_splitting._review_safe_generated_label(
        label,
        ["c1"],
        {"c1": {"customer_problem_text": "확인 부탁드립니다"}},
        "sequence:확인질문>정책안내",
    )

    assert safe_label["name"] == "미분류 문의"
    assert "요청확인" not in safe_label["name"]
    assert "기준확인" not in safe_label["name"]


def test_split_label_terms_normalize_polite_question_frame_and_copula_suffix() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {"customer_problem_text": "여쭤보겠습니다 자동이체인데 신청 문의"},
            "c2": {"customer_problem_text": "자동이체 신청 가능한가요"},
        },
    )

    assert label["name"] == "자동이체 신청 문의"
    assert "여쭤보겠습니다" not in label["name"]
    assert "자동이체인데" not in label["name"]


def test_split_label_filters_question_noise_from_action_object_frame() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2", "c3"],
        {
            "c1": {
                "customer_problem_text": "지금 이게 어떻게 된 건지 확인 요청",
                "action_object_frame": {"object": "지금 이게 건지", "action": "확인", "confidence": 0.93},
            },
            "c2": {
                "customer_problem_text": "문자 확인 어떻게 하나요",
                "action_object_frame": {"object": "문자", "action": "확인", "confidence": 0.85},
            },
            "c3": {
                "customer_problem_text": "뭘 확인하면 되죠",
                "action_object_frame": {"object": "되죠", "action": "확인", "confidence": 0.85},
            },
        },
    )

    assert label["name"] == "문자 확인 문의"
    assert "건지" not in label["name"]
    assert "되죠" not in label["name"]


def test_split_label_uses_action_only_when_frame_object_is_only_question_noise() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {
                "customer_problem_text": "가까운 곳 어디로 가서 확인을 해야되나요",
                "action_object_frame": {"object": "어디로 가서", "action": "가능여부확인", "confidence": 0.93},
            },
            "c2": {
                "customer_problem_text": "정확히 어떻게 확인하는 방법을 알려주세요",
                "action_object_frame": {"object": "하는 방법 해주시면", "action": "가능여부확인", "confidence": 0.93},
            },
        },
    )

    assert label["name"] == "가능여부확인 문의"
    assert label["candidates"][0]["source"] == "action_frame_action"
    assert "어디" not in label["name"]
    assert "방법" not in label["name"]


def test_split_label_does_not_replace_specific_terms_with_action_only_label() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {
                "customer_problem_text": "멜론 결제 확인 부탁드립니다",
                "action_object_frame": {"object": "하는 방법", "action": "신청", "confidence": 0.93},
            },
            "c2": {
                "customer_problem_text": "멜론 결제 다시 문의합니다",
                "action_object_frame": {"object": "방법 해주시면", "action": "신청", "confidence": 0.93},
            },
        },
    )

    assert label["name"] == "멜론 결제 문의"
    assert label["candidates"][0]["source"] == "term_frequency"
    assert "신청 문의" not in [candidate["name"] for candidate in label["candidates"]]


def test_split_label_terms_preserve_domain_terms_after_colloquial_suffix_cleanup() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {"customer_problem_text": "체크카드거든 결제 문의"},
            "c2": {"customer_problem_text": "체크카드 결제 확인"},
        },
    )

    assert label["name"] == "체크카드 결제 문의"
    assert "거든" not in label["name"]


def test_split_label_terms_filter_short_reaction_fillers() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {"customer_problem_text": "뭐야 신청 문의"},
            "c2": {"customer_problem_text": "들어왔어 말고 신청 확인"},
        },
    )

    assert label["name"] == "신청 문의"
    assert "뭐야" not in label["name"]
    assert "들어왔어" not in label["name"]
    assert "말고" not in label["name"]


def test_split_label_terms_filter_response_markers() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {"customer_problem_text": "그니깐 보통 문의"},
            "c2": {"customer_problem_text": "카드사 그렇구나 확인"},
        },
    )

    assert "그니깐" not in label["name"]
    assert "보통" not in label["name"]
    assert "그렇구나" not in label["name"]


def test_review_safe_label_falls_back_for_dialogue_only_term_frequency_label() -> None:
    preprocessed_index = {
        "c1": {"customer_problem_text": "딱 한 가지만 더 여쭤보면요", "flow_events": ["확인질문"]},
        "c2": {
            "customer_problem_text": "상담하신 분은 좀 있잖아요",
            "flow_events": ["확인질문", "정책안내"],
        },
        "c3": {"customer_problem_text": "네 들어왔어요", "flow_events": ["확인질문", "해결"]},
    }

    regenerated = flow_splitting._regenerated_split_label(["c1", "c2", "c3"], preprocessed_index)
    label = flow_splitting._review_safe_generated_label(
        regenerated,
        ["c1", "c2", "c3"],
        preprocessed_index,
        "no_signal",
    )

    assert label["name"] == "미분류 문의"
    assert label["score"] <= 0.45
    assert label["candidates"][0]["source"] == "weak_label_flow_fallback"
    assert "상담하신" not in label["name"]


def test_review_safe_label_keeps_grounded_action_label_after_channel_cleanup() -> None:
    preprocessed_index = {
        "c1": {"customer_problem_text": "전화로 취소 문의"},
        "c2": {"customer_problem_text": "취소 해놓게요 취소할려구요"},
    }

    regenerated = flow_splitting._regenerated_split_label(["c1", "c2"], preprocessed_index)
    label = flow_splitting._review_safe_generated_label(
        regenerated,
        ["c1", "c2"],
        preprocessed_index,
        "no_signal",
    )

    assert label["name"] == "취소 문의"
    assert label["score"] >= 0.5
    assert label["candidates"][0]["source"] != "weak_label_flow_fallback"
    assert "해놓게" not in label["name"]


def test_review_safe_label_downgrades_sentence_fragment_action_object_label() -> None:
    noisy_label = {
        "name": "가요 취소 문의",
        "score": 0.70,
        "evidenceCoverage": 0.5,
        "actionObjectValidity": 0.78,
        "candidates": [
            {
                "name": "가요 취소 문의",
                "score": 0.70,
                "evidenceCoverage": 0.5,
                "actionObjectValidity": 0.78,
                "source": "action_object_frame",
            }
        ],
    }

    label = flow_splitting._review_safe_generated_label(noisy_label, ["c1"], {}, "mixed_flow")

    assert label["name"] == "취소 문의"
    assert label["score"] <= 0.55
    assert label["candidates"][0]["source"] == "noise_reduced_review_fallback"


def test_review_safe_label_downgrades_introductory_fragment_term_label() -> None:
    noisy_label = {
        "name": "항공권 이번에 문의",
        "score": 0.61,
        "evidenceCoverage": 0.5,
        "actionObjectValidity": 0.35,
        "candidates": [
            {
                "name": "항공권 이번에 문의",
                "score": 0.61,
                "evidenceCoverage": 0.5,
                "actionObjectValidity": 0.35,
                "source": "term_frequency",
            }
        ],
    }

    label = flow_splitting._review_safe_generated_label(noisy_label, ["c1"], {}, "no_signal|action:정보확인")

    assert label["name"] == "항공권 문의"
    assert label["score"] <= 0.55
    assert label["candidates"][0]["source"] == "noise_reduced_review_fallback"


def test_review_safe_label_downgrades_raw_sentence_tail_fragments() -> None:
    noisy_label = {
        "name": "보낼 봐야 해지 문의",
        "score": 0.72,
        "evidenceCoverage": 0.6,
        "actionObjectValidity": 0.78,
        "candidates": [
            {
                "name": "보낼 봐야 해지 문의",
                "score": 0.72,
                "evidenceCoverage": 0.6,
                "actionObjectValidity": 0.78,
                "source": "action_object_frame",
            }
        ],
    }

    label = flow_splitting._review_safe_generated_label(noisy_label, ["c1"], {}, "mixed_flow")

    assert label["name"] == "해지 문의"
    assert label["score"] <= 0.55
    assert label["candidates"][0]["source"] == "noise_reduced_review_fallback"
    assert "보낼" not in label["name"]
    assert "봐야" not in label["name"]


def test_review_safe_label_downgrades_colloquial_connective_fragments() -> None:
    noisy_label = {
        "name": "그래갖고 해지 문의",
        "score": 0.71,
        "evidenceCoverage": 0.6,
        "actionObjectValidity": 0.78,
        "candidates": [
            {
                "name": "그래갖고 해지 문의",
                "score": 0.71,
                "evidenceCoverage": 0.6,
                "actionObjectValidity": 0.78,
                "source": "action_object_frame",
            }
        ],
    }

    label = flow_splitting._review_safe_generated_label(noisy_label, ["c1"], {}, "mixed_flow")

    assert label["name"] == "해지 문의"
    assert label["score"] <= 0.55
    assert label["candidates"][0]["source"] == "noise_reduced_review_fallback"
    assert "그래갖고" not in label["name"]


def test_review_safe_label_rejects_low_joint_action_object_fragments() -> None:
    noisy_label = {
        "name": "잠깐 들어가서 확인 문의",
        "score": 0.70,
        "evidenceCoverage": 0.43,
        "memberEvidenceCoverage": 0.43,
        "objectCoverage": 0.14,
        "actionCoverage": 1.0,
        "objectActionJointCoverage": 0.14,
        "actionObjectValidity": 0.74,
        "specificity": 1.0,
        "candidates": [
            {
                "name": "잠깐 들어가서 확인 문의",
                "score": 0.70,
                "evidenceCoverage": 0.43,
                "objectActionJointCoverage": 0.14,
                "actionObjectValidity": 0.74,
                "source": "action_object_frame",
            }
        ],
    }

    label = flow_splitting._review_safe_generated_label(
        noisy_label,
        ["c1", "c2"],
        {"c1": {"customer_problem_text": "확인 부탁드립니다"}, "c2": {"customer_problem_text": "조회해 주세요"}},
        "no_signal|action:확인",
    )

    assert label["name"] == "확인 처리 문의"
    assert label["candidates"][0]["source"] == "weak_label_flow_fallback"
    assert "잠깐" not in label["name"]
    assert "들어가서" not in label["name"]


def test_review_safe_label_rejects_information_check_sentence_fragments() -> None:
    noisy_label = {
        "name": "많았는데 정보확인 문의",
        "score": 0.68,
        "evidenceCoverage": 0.67,
        "memberEvidenceCoverage": 0.67,
        "objectCoverage": 0.33,
        "actionCoverage": 1.0,
        "objectActionJointCoverage": 0.33,
        "actionObjectValidity": 0.80,
        "specificity": 0.82,
        "candidates": [
            {
                "name": "많았는데 정보확인 문의",
                "score": 0.68,
                "evidenceCoverage": 0.67,
                "objectActionJointCoverage": 0.33,
                "actionObjectValidity": 0.80,
                "source": "action_object_frame",
            }
        ],
    }

    label = flow_splitting._review_safe_generated_label(noisy_label, ["c1"], {}, "no_signal|action:정보확인")

    assert label["name"] == "정보확인 처리 문의"
    assert label["candidates"][0]["source"] == "weak_label_flow_fallback"
    assert "많았는데" not in label["name"]


def test_review_safe_label_removes_predicate_fragments_without_status_words() -> None:
    noisy_label = {
        "name": "말씀이신 결제 문의",
        "score": 0.68,
        "evidenceCoverage": 0.50,
        "memberEvidenceCoverage": 0.50,
        "objectCoverage": 0.25,
        "actionCoverage": 1.0,
        "objectActionJointCoverage": 0.25,
        "actionObjectValidity": 0.76,
        "specificity": 0.82,
        "candidates": [
            {
                "name": "말씀이신 결제 문의",
                "score": 0.68,
                "evidenceCoverage": 0.50,
                "objectActionJointCoverage": 0.25,
                "actionObjectValidity": 0.76,
                "source": "action_object_frame",
            }
        ],
    }

    label = flow_splitting._review_safe_generated_label(noisy_label, ["c1"], {}, "mixed_flow")

    assert label["name"] == "결제 문의"
    assert "말씀이신" not in label["name"]
    assert "검토" not in label["name"]


def test_review_safe_label_drops_observed_sentence_tail_from_object_label() -> None:
    noisy_label = {
        "name": "할인 찍혀 확인 문의",
        "score": 0.62,
        "evidenceCoverage": 0.50,
        "memberEvidenceCoverage": 0.50,
        "objectCoverage": 0.25,
        "actionCoverage": 0.50,
        "objectActionJointCoverage": 0.25,
        "actionObjectValidity": 0.62,
        "specificity": 0.82,
        "candidates": [{"name": "할인 찍혀 확인 문의", "source": "term_frequency"}],
    }

    label = flow_splitting._review_safe_generated_label(noisy_label, ["c1"], {}, "no_signal")

    assert label["name"] == "할인 문의"
    assert "찍혀" not in label["name"]
    assert "검토" not in label["name"]


def test_review_safe_label_keeps_clean_lowish_joint_object_action_label() -> None:
    label = {
        "name": "가상계좌 정보확인 문의",
        "score": 0.66,
        "evidenceCoverage": 0.60,
        "memberEvidenceCoverage": 0.60,
        "objectCoverage": 0.80,
        "actionCoverage": 0.40,
        "objectActionJointCoverage": 0.40,
        "actionObjectValidity": 0.76,
        "specificity": 0.82,
        "candidates": [
            {
                "name": "가상계좌 정보확인 문의",
                "score": 0.66,
                "evidenceCoverage": 0.60,
                "objectActionJointCoverage": 0.40,
                "actionObjectValidity": 0.76,
                "source": "action_object_frame",
            }
        ],
    }

    reviewed = flow_splitting._review_safe_generated_label(label, ["c1"], {}, "no_signal|action:정보확인")

    assert reviewed["name"] == "가상계좌 정보확인 문의"
    assert "검토" not in reviewed["name"]


def test_review_safe_label_uses_observed_split_action_when_label_lacks_action() -> None:
    label = flow_splitting._review_safe_generated_label(
        {
            "name": "금액 문의",
            "score": 0.31,
            "evidenceCoverage": 0.5,
            "memberEvidenceCoverage": 0.5,
            "objectCoverage": 1.0,
            "actionCoverage": 0.0,
            "objectActionJointCoverage": 0.0,
            "actionObjectValidity": 0.35,
            "specificity": 0.82,
            "candidates": [{"source": "term_frequency"}],
        },
        ["c1", "c2"],
        {
            "c1": {"customer_problem_text": "이번 달 결제 금액이 얼마인가요"},
            "c2": {"customer_problem_text": "납부 금액 확인하고 싶어요"},
        },
        "no_signal|action:결제",
    )

    assert label["name"] == "금액 결제 문의"
    assert label["actionCoverage"] == 1.0
    assert label["objectActionJointCoverage"] == 1.0


def test_review_safe_label_uses_flow_fallback_when_all_terms_are_discourse_noise() -> None:
    noisy_label = {
        "name": "있잖아 중후한데 문의",
        "score": 0.48,
        "evidenceCoverage": 0.2,
        "actionObjectValidity": 0.35,
        "candidates": [
            {
                "name": "있잖아 중후한데 문의",
                "score": 0.48,
                "evidenceCoverage": 0.2,
                "actionObjectValidity": 0.35,
                "source": "term_frequency",
            }
        ],
    }

    label = flow_splitting._review_safe_generated_label(
        noisy_label,
        ["c1", "c2"],
        {"c1": {"flow_events": ["확인질문"]}, "c2": {"flow_events": ["확인질문", "정책안내"]}},
        "no_signal",
    )

    assert label["name"] == "미분류 문의"
    assert label["score"] <= 0.45
    assert label["candidates"][0]["source"] == "weak_label_flow_fallback"


def test_review_safe_label_keeps_specific_label_without_discourse_noise() -> None:
    label = {
        "name": "카드 취소 문의",
        "score": 0.70,
        "evidenceCoverage": 0.5,
        "objectActionJointCoverage": 0.5,
        "actionObjectValidity": 0.78,
        "candidates": [
            {
                "name": "카드 취소 문의",
                "score": 0.70,
                "evidenceCoverage": 0.5,
                "objectActionJointCoverage": 0.5,
                "actionObjectValidity": 0.78,
                "source": "action_object_frame",
            }
        ],
    }

    reviewed = flow_splitting._review_safe_generated_label(label, ["c1"], {}, "mixed_flow")

    assert reviewed["name"] == "카드 취소 문의"
    assert reviewed["score"] == 0.70
