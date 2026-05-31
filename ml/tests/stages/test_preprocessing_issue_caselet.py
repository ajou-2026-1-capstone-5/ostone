from __future__ import annotations

from pipeline.stages.preprocessing.issue_caselet import extract_issue_caselets
from pipeline.stages.preprocessing.types import Conversation, ConversationTurn


def test_extract_issue_caselets_splits_after_resolution_and_new_issue_cue() -> None:
    conversation = Conversation(
        conversation_id="conv-1",
        dataset_id="ds-1",
        ended_status="resolved",
        turns=(
            ConversationTurn("t0", "customer", "첫 번째 요청을 변경하고 싶어요"),
            ConversationTurn("t1", "agent", "변경 처리 완료되었습니다"),
            ConversationTurn("t2", "customer", "그리고 다른 건 환불도 가능한가요?"),
            ConversationTurn("t3", "agent", "환불 규정을 안내드립니다"),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    assert [caselet["caseletId"] for caselet in caselets] == ["conv-1#issue-01", "conv-1#issue-02"]
    assert caselets[0]["turnStart"] == 0
    assert caselets[0]["turnEnd"] == 1
    assert caselets[1]["turnStart"] == 2
    assert caselets[1]["turnEnd"] == 3
    assert caselets[1]["workflowSignal"]["requires_payment_check"] is True
    assert caselets[1]["flowSignatureDim"] == 61
    assert caselets[1]["evidenceTurnIds"] == ["t2", "t3"]
    assert caselets[1]["qualityTier"] == "A"
    assert caselets[1]["actionObjectFrame"]["action"] == "환불"


def test_extract_issue_caselets_keeps_single_issue_without_boundary() -> None:
    conversation = Conversation(
        conversation_id="conv-2",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "요청 상태를 확인하고 싶어요"),
            ConversationTurn("t1", "agent", "현재 처리 상태를 확인해드리겠습니다"),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    assert len(caselets) == 1
    assert caselets[0]["caseletId"] == "conv-2#issue-01"
    assert caselets[0]["sourceQualityFlags"] == []
    assert caselets[0]["actionObjectFrame"]["object"] == "상태"
    assert caselets[0]["actionObjectFrame"]["action"] == "확인"
    assert caselets[0]["actionObjectFrame"]["objectQuality"] > 0.0


def test_extract_issue_caselets_does_not_promote_discourse_as_frame_object() -> None:
    conversation = Conversation(
        conversation_id="conv-discourse",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "아 그렇군요. 그러면 어떤 정보를 보내야 하나요?"),
            ConversationTurn("t1", "agent", "필요 정보를 안내드립니다"),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "정보확인"
    assert frame["object"] == ""
    assert frame["objectQuality"] == 0.0
    assert frame["confidence"] < 0.75


def test_extract_issue_caselets_cleans_discourse_inside_frame_object_phrase() -> None:
    conversation = Conversation(
        conversation_id="conv-frame-cleanup",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "계좌를 바꾸었는지 까먹어서 변경 문의합니다."),
            ConversationTurn("t1", "agent", "계좌 변경 가능 여부를 확인하겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "변경"
    assert frame["object"] == "계좌"
    assert "까먹어서" not in frame["object"]
    assert "바꾸었는지" not in frame["object"]


def test_extract_issue_caselets_normalizes_colloquial_money_object() -> None:
    conversation = Conversation(
        conversation_id="conv-money-normalization",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "이번에 돈이 얼마나 결제되는지 확인하고 싶어요."),
            ConversationTurn("t1", "agent", "결제 금액을 확인하겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["object"] == "금액"
    assert "이번에" not in frame["object"]
    assert "돈이" not in frame["object"]


def test_extract_issue_caselets_drops_acknowledgement_object_and_prefers_specific_action() -> None:
    conversation = Conversation(
        conversation_id="conv-ack-object",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "네, 맞습니다. 가상계좌 결제 문의입니다."),
            ConversationTurn("t1", "agent", "결제 정보를 확인하겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["object"] == "가상계좌"
    assert frame["action"] == "결제"
    assert "맞습니다" not in frame["object"]


def test_extract_issue_caselets_prefers_specific_action_over_availability_marker() -> None:
    conversation = Conversation(
        conversation_id="conv-specific-action",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "카드 결제를 할 수 없는데 확인 부탁드립니다."),
            ConversationTurn("t1", "agent", "결제 상태를 확인하겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "결제"


def test_extract_issue_caselets_removes_sentence_residue_from_object_phrase() -> None:
    conversation = Conversation(
        conversation_id="conv-residue-object",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "어떤 카드를 써야 되는 건지 포인트가 궁금해서요."),
            ConversationTurn("t1", "agent", "포인트 적용 기준을 안내드립니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "정보확인"
    assert frame["object"] == "카드 포인트"
    assert "써야" not in frame["object"]
    assert "건지" not in frame["object"]


def test_extract_issue_caselets_extracts_compound_action_object() -> None:
    conversation = Conversation(
        conversation_id="conv-compound-action",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "기기변경 관련된 지원 사항이 있는지 궁금합니다."),
            ConversationTurn("t1", "agent", "기기 변경 가능 여부를 확인하겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "변경"
    assert frame["object"] == "기기"
    assert "관련된" not in frame["object"]
    assert "사항" not in frame["object"]


def test_extract_issue_caselets_drops_sentence_tail_from_availability_object() -> None:
    conversation = Conversation(
        conversation_id="conv-availability-object",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "요금제는 어떻게 되는 거예요?"),
            ConversationTurn("t1", "agent", "요금제 조건을 안내드립니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["object"] == "요금제"
    assert "거예" not in frame["object"]


def test_extract_issue_caselets_removes_korean_discourse_noise_from_action_object_frame() -> None:
    conversation = Conversation(
        conversation_id="conv-discourse-heavy-frame",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "될지 모르겠네 가능하군 가격 예약 문의입니다."),
            ConversationTurn("t1", "agent", "예약 가격을 확인하겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "예약"
    assert frame["object"] == "가격"
    assert "될지" not in frame["object"]
    assert "모르겠네" not in frame["object"]
    assert "가능하군" not in frame["object"]


def test_extract_issue_caselets_removes_connective_noise_but_keeps_specific_object() -> None:
    conversation = Conversation(
        conversation_id="conv-connective-frame",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "요금 확인하니까 결제 문의하려구요."),
            ConversationTurn("t1", "agent", "요금 결제 내역을 확인하겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "결제"
    assert frame["object"] == "요금"
    assert "확인하니까" not in frame["object"]


def test_extract_issue_caselets_removes_question_tail_noise_from_frame_object() -> None:
    conversation = Conversation(
        conversation_id="conv-question-tail-frame",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "할인 있을까 뭐예 결제 문의입니다."),
            ConversationTurn("t1", "agent", "할인 결제 가능 여부를 확인하겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "결제"
    assert frame["object"] == "할인"
    assert "있을까" not in frame["object"]
    assert "뭐예" not in frame["object"]


def test_extract_issue_caselets_removes_speaker_and_time_residue_from_frame_object() -> None:
    conversation = Conversation(
        conversation_id="conv-speaker-time-residue",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "내가 작년에 체크 카드로만 신청을 했는데요."),
            ConversationTurn("t1", "agent", "카드 신청 내역을 확인하겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "신청"
    assert "카드" in frame["object"]
    assert "내가" not in frame["object"]
    assert "작년" not in frame["object"]
    assert "로만" not in frame["object"]


def test_extract_issue_caselets_removes_colloquial_verb_residue_from_frame_object() -> None:
    conversation = Conversation(
        conversation_id="conv-colloquial-residue",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "디씨씨 문자가 떠가지고 제가 그거를 갖다가 서비스 신청을 했거든요."),
            ConversationTurn("t1", "agent", "서비스 신청 상태를 확인하겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "신청"
    assert "서비스" in frame["object"]
    assert "떠" not in frame["object"]
    assert "갖다" not in frame["object"]
    assert "했" not in frame["object"]


def test_extract_issue_caselets_treats_price_questions_as_information_checks() -> None:
    conversation = Conversation(
        conversation_id="conv-price-info",
        dataset_id="ds-1",
        turns=(
            ConversationTurn(
                "t0",
                "customer",
                "성인 요금과 어린이 요금은 어떻게 되나요? 현금 결제하면 할인이 되나요?",
            ),
            ConversationTurn("t1", "agent", "요금과 할인 기준을 안내드리겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "정보확인"
    assert any(term in frame["object"] for term in ("요금", "할인", "금액"))


def test_extract_issue_caselets_removes_method_and_speed_residue_from_booking_object() -> None:
    conversation = Conversation(
        conversation_id="conv-booking-residue",
        dataset_id="ds-1",
        turns=(
            ConversationTurn(
                "t0",
                "customer",
                "연휴에 항공권 예약하려고 하는데 홈페이지에서 예약 방법 알려주세요. 리조트 예약도 같이 하고 싶어요.",
            ),
            ConversationTurn("t1", "agent", "예약 가능 여부를 확인하겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "예약"
    assert "홈페이지" in frame["object"]
    assert "리조트" in frame["object"]
    assert "방법" not in frame["object"]
    assert "연휴" not in frame["object"]


def test_extract_issue_caselets_rejects_sentence_tail_as_frame_object() -> None:
    conversation = Conversation(
        conversation_id="conv-tail-fragment",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "예, 그게 잠깐 뭐 어디 들어가서 확인이 되는구나."),
            ConversationTurn("t1", "agent", "확인 가능한 항목을 안내드리겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "확인"
    assert frame["object"] == ""
    assert frame["objectQuality"] == 0.0


def test_extract_issue_caselets_keeps_domain_object_after_removing_predicate_fragment() -> None:
    conversation = Conversation(
        conversation_id="conv-domain-object-fragment",
        dataset_id="ds-1",
        turns=(
            ConversationTurn(
                "t0",
                "customer",
                "제가 기계를 새로 사게 되면 요금제는 어떻게 되는 거예요?",
            ),
            ConversationTurn("t1", "agent", "요금제 변경 조건을 확인하겠습니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    frame = caselets[0]["actionObjectFrame"]
    assert frame["action"] == "정보확인"
    assert "요금제" in frame["object"]
    assert "사게" not in frame["object"]


def test_extract_issue_caselets_marks_no_agent_short_caselet() -> None:
    conversation = Conversation(
        conversation_id="conv-3",
        dataset_id="ds-1",
        turns=(ConversationTurn("t0", "customer", "문의"),),
    )

    caselets = extract_issue_caselets(conversation)

    assert caselets[0]["sourceQualityFlags"] == ["short_caselet", "no_agent_turn"]
    assert caselets[0]["qualityTier"] == "C"


def test_extract_issue_caselets_filters_acknowledgement_only_segments() -> None:
    conversation = Conversation(
        conversation_id="conv-4",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "네, 알겠습니다."),
            ConversationTurn("t1", "agent", "좋은 하루 보내십시오."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    assert caselets[0]["filtered"] is True
    assert "low_information_customer_issue" in caselets[0]["sourceQualityFlags"]
    assert "greeting_or_closing_only_customer_issue" in caselets[0]["sourceQualityFlags"]
    assert caselets[0]["qualityScore"] == 0.0
    assert caselets[0]["qualityTier"] == "D"


def test_extract_issue_caselets_filters_no_further_request_segments() -> None:
    conversation = Conversation(
        conversation_id="conv-5",
        dataset_id="ds-1",
        turns=(
            ConversationTurn("t0", "customer", "아 네, 다른 건 없어요."),
            ConversationTurn("t1", "agent", "감사합니다."),
        ),
    )

    caselets = extract_issue_caselets(conversation)

    assert caselets[0]["filtered"] is True
    assert "no_further_request_customer_issue" in caselets[0]["sourceQualityFlags"]
