from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import replace
from typing import Any

from pipeline.stages.preprocessing.canonicalize import apply_canonicalization
from pipeline.stages.preprocessing.flow_signature import (
    build_signature,
    infer_event,
    infer_event_detail,
    infer_outcome,
    infer_workflow_signal,
)
from pipeline.stages.preprocessing.types import (
    FLOW_SIGNATURE_DIM,
    SPEAKER_ROLE_AGENT,
    SPEAKER_ROLE_CUSTOMER,
    Conversation,
    ConversationTurn,
)

_NEW_ISSUE_CUES = (
    "그리고",
    "추가로",
    "추가 문의",
    "다른",
    "또",
    "한 가지",
    "한가지",
    "그런데",
    "근데",
    "also",
    "another",
    "one more",
)
_RESOLUTION_CUES = (
    "처리",
    "완료",
    "해결",
    "안내",
    "가능합니다",
    "도와드렸",
    "접수",
    "변경되었",
    "확인되었습니다",
)
_TOKEN_PATTERN = re.compile(r"[0-9A-Za-z가-힣_]+")
_MIN_SEGMENT_TURNS = 2
_BOUNDARY_THRESHOLD = 0.50
_LOW_INFORMATION_FLAGS = {
    "low_information_customer_issue",
    "acknowledgement_only_customer_issue",
    "greeting_or_closing_only_customer_issue",
    "no_further_request_customer_issue",
    "deferred_or_declined_customer_issue",
}
_ACKNOWLEDGEMENT_TERMS = frozenset(
    {
        "네",
        "예",
        "아",
        "어",
        "음",
        "응",
        "알겠습니다",
        "알겠어요",
        "알겠어",
        "알았습니다",
        "괜찮아요",
        "괜찮습니다",
        "아니요",
        "아니오",
        "맞습니다",
        "맞아요",
        "없어요",
        "없습니다",
        "없는데요",
        "그렇군요",
        "그래요",
    }
)
_GREETING_OR_CLOSING_TERMS = frozenset(
    {
        "여보세요",
        "여보세",
        "수고하세요",
        "수고하십시오",
        "수고하십니다",
        "감사합니다",
        "고맙습니다",
        "고생하셨습니다",
        "부탁합니다",
        "부탁드립니다",
        "건강하세요",
    }
)
_PLACEHOLDER_TERMS = frozenset(
    {
        "date",
        "time",
        "phone",
        "email",
        "address",
        "account",
        "card_number",
        "order_id",
        "person",
    }
)
_NO_FURTHER_REQUEST_PATTERNS = (
    re.compile(r"다른\s*(건|것|문의|사항)?\s*없"),
    re.compile(r"더\s*(이상\s*)?(문의|사항|질문)?\s*없"),
)
_DEFER_OR_DECLINE_PATTERNS = (
    re.compile(r"나중에.*(할게|하겠|연락|전화)"),
    re.compile(r"그냥\s*그대로\s*(할래|하겠|둘래)"),
    re.compile(r"상관이\s*없"),
)
_ACTION_PATTERNS = (
    ("환불", re.compile(r"환불|환급|돌려받|돈\s*돌려|취소.*금액|refund")),
    ("취소", re.compile(r"취소|철회|cancel")),
    ("변경", re.compile(r"변경|바꾸|수정|교체|change|modify")),
    ("견적", re.compile(r"견적|estimate|quote")),
    ("예약", re.compile(r"예약|reserve|booking")),
    ("구매", re.compile(r"구매|구입|buy|purchase")),
    ("신청", re.compile(r"신청|등록|접수|가입|apply|register")),
    ("해지", re.compile(r"해지|탈퇴|중지|정지|해제|terminate|stop")),
    ("결제", re.compile(r"결제|납부|청구|이체|입금|pay|billing|charge")),
    ("복구", re.compile(r"복구|재발급|재설정|분실|찾아|recover|reset")),
    ("이관", re.compile(r"상담원|담당자|연결|이관|전화|contact")),
    ("가능여부확인", re.compile(r"가능|되나요|될까요|할\s*수|available|availability")),
    ("정보확인", re.compile(r"어떤\s*정보|필요한\s*정보|무슨\s*정보|궁금|알고\s*싶|알려|안내|문의|question|inquiry")),
    ("확인", re.compile(r"확인|조회|알려|어디|상태|내역|check|status")),
)
_INTENT_TYPE_PATTERNS = (
    ("complaint", re.compile(r"불만|문제|오류|안\s*되|못\s*하|왜|이상|장애|error|issue")),
    ("request", re.compile(r"해주세요|해줘|하고\s*싶|가능|신청|변경|취소|환불|요청|request")),
    ("status_check", re.compile(r"어디|언제|상태|조회|확인|내역|status|check")),
)
_FRAME_STOPWORDS = frozenset(
    {
        "문의",
        "문의드",
        "문의드립니다",
        "문의드릴",
        "문의하나드립니다",
        "문의입니다",
        "문의사항",
        "요청",
        "건지",
        "건가",
        "거",
        "그게",
        "그건",
        "그런",
        "그대로",
        "그러는데",
        "거예",
        "거예요",
        "알고",
        "알고있구",
        "있구",
        "요청드렸는데",
        "확인",
        "변경",
        "취소",
        "환불",
        "신청",
        "해지",
        "결제",
        "가능",
        "가능한",
        "가능한가요",
        "가능한지",
        "가능할까요",
        "되나요",
        "되나",
        "될까요",
        "해주세요",
        "해줘",
        "부탁드립니다",
        "부탁드려요",
        "하고",
        "싶어",
        "싶은데",
        "싶어요",
        "어떻게",
        "언제",
        "어디",
        "어떤",
        "보면",
        "문제",
        "오류",
        "잠깐",
        "점이",
        "생기면",
        "들어가서",
        "들어온",
        "들어온걸로",
        "걸로",
        "되는구나",
        "해놓",
        "많았는데",
        "사게",
        "쓰다",
        "쓰다가",
        "싶었던",
        "곳이라서",
        "이렇게",
        "그것",
        "고객",
        "고객센터",
        "센터",
        "상담",
        "상담원",
        "담당자",
        "알겠습니다",
        "알겠어요",
        "알겠어",
        "그렇군요",
        "그렇군",
        "하군",
        "그러면",
        "그럼",
        "여기서",
        "어제",
        "대해",
        "제가",
        "다른",
        "아니고",
        "그거",
        "그러니까",
        "당연히",
        "얘기",
        "말",
        "말을",
        "말은",
        "말이",
        "나오더",
        "나오더라고",
        "나타나",
        "나타나는",
        "동안",
        "동안에",
        "관련된",
        "사항",
        "작아서",
        "쪽에서",
        "있어서",
        "있으면",
        "있으시면",
        "있습니다",
        "적용되지",
        "않으면",
        "않는",
        "생각",
        "생각하고",
        "후에",
        "다양하네",
        "진행",
        "방법",
        "바로",
        "빠른",
        "유효한",
        "궁금해",
        "좋겠네요",
        "연휴",
        "포함해서",
        "포함",
        "총",
        "필요한",
        "정보",
        "정보들",
        "품목별",
        "간단하게",
        "한번",
        "안하게",
        "주시겠어",
        "보내주시겠어",
        "주시고",
        "나머지",
        "어저께",
        "했다는데",
        "그랬는데",
        "받았는데",
        "왔는데",
        "사용해가지고",
        "요청해가지고",
        "그래가지고",
        "처리했는데",
        "싶어서",
        "그걸",
        "같은데",
        "새로",
        "만들",
        "내고",
        "예전",
        "전에",
        "나간다",
        "같이",
        "티비쪽",
        "있으세",
        "일은",
        "쌓이",
        "들어",
        "일로",
        "인가",
        "되어",
        "되어서",
        "돼서",
        "되는",
        "된다",
        "된다는",
        "정리해서",
        "내일",
        "으로",
        "로",
        "메일",
        "메일로",
        "드립니다",
        "드려요",
        "드릴게",
        "드릴게요",
        "다시",
        "차이",
        "어느",
        "정도",
        "얼마",
        "얼마나",
        "너무",
        "좋고",
        "사이",
        "한지",
        "주실",
        "하나",
        "하나요",
        "뭐예",
        "뭐예요",
        "뭐에요",
        "뭐지",
        "뭔지",
        "요거",
        "이런",
        "저런",
        "사는",
        "있다고",
        "왔었는데",
        "바꾸긴",
        "잘된",
        "잘됨",
        "작년",
        "지난해",
        "올해",
        "작년에",
        "지난해에",
        "올해에",
        "있을까",
        "있을까요",
        "대략",
        "대강",
        "진행하려면",
        "진행하면",
        "진행하고",
        "연락드릴게",
        "연락드릴게요",
        "연락",
        "전화",
        "전화로",
        "전화번호",
        "휴대폰번호",
        "핸드폰번호",
        "카드번호",
        "계좌번호",
        "주문번호",
        "예약번호",
        "고객번호",
        "번호",
        "연락처",
        "저기",
        "내가",
        "나는",
        "저는",
        "우리가",
        "우리는",
        "그냥",
        "이제",
        "아마",
        "가지고",
        "갖다",
        "갖다가",
        "떠",
        "했",
        "했다",
        "했거든",
        "했거든요",
        "했는데",
        "했어요",
        "해가지고",
        "나와서",
        "떠서",
        "떠가지고",
        "보내",
        "보내야",
        "보내고",
        "받아",
        "받을",
        "받고",
        "받거나",
        "받아서",
        "추가로",
        "이번에",
        "없이",
        "써야",
        "해야",
        "하면",
        "해도",
        "했어",
        "했어요",
        "해주면",
        "빌려주면",
        "하려구",
        "하려구요",
        "하니까",
        "확인하니까",
        "것",
        "것만",
        "값",
        "값이",
        "아무튼간에",
        "까먹어서",
        "에요",
        "예요",
        "나가",
        "나가는",
        "나가거든",
        "내야",
        "지금",
        "바꾸",
        "바꾸었",
        "바꾸었는지",
        "바꿔",
        "드는",
        "될지",
        "되게끔",
        "모르겠",
        "모르겠네",
        "가능하군",
        "오르",
        "오르는",
        "오르겠",
        "오르겠죠",
        "아니면",
        "원래",
        "오긴",
        "제대",
        "어렵다고",
        "방금",
        "주십시오",
        "동의합니다",
        "고마워",
        "들어가",
        "들어가고",
        "들어간",
        "후로",
        "보니",
        "언제든지",
        "찾아보고",
        "알아봐주세",
        "알아봐주세요",
        "월요일",
        "화요일",
        "수요일",
        "목요일",
        "금요일",
        "토요일",
        "일요일",
        "please",
        "request",
        "check",
        "status",
    }
)
_OBJECT_PHRASE_PATTERNS = (
    re.compile(
        r"(?P<object>[0-9A-Za-z가-힣_\s]{2,36}?)(?:이|가|은|는|을|를|도)?\s*"
        r"(?:가능|되는|되나요|될까요|할\s*수|궁금|알고\s*싶|알려|확인|조회|변경|취소|환불|예약|구매|구입|신청|문의)"
    ),
    re.compile(
        r"(?:대상|항목|상품|서비스|건|내용|일정|날짜|금액|요금|가격|상태|내역)(?=\s|은|는|이|가|을|를)"
        r"\s*(?:은|는|이|가|을|를)?\s*"
        r"(?P<object>[0-9A-Za-z가-힣_\s]{2,28})"
    ),
)
_FRAME_SUFFIXES = (
    "해주세요",
    "해줘요",
    "해줘",
    "했거든요",
    "했거든",
    "했는데",
    "했어요",
    "해가지고",
    "가지고",
    "떠가지고",
    "나와서",
    "떠서",
    "드립니다",
    "드려요",
    "드릴게요",
    "드릴게",
    "하려면",
    "하려고",
    "하려구요",
    "하려구",
    "하니까",
    "니까",
    "받아서",
    "입니다",
    "었는지",
    "는지",
    "하고",
    "싶어요",
    "싶어서",
    "싶어",
    "싶은데",
    "가능한가요",
    "가능한지",
    "가능할까요",
    "되나요",
    "될까요",
    "되는지",
    "인가요",
    "인지",
    "라고",
    "더라고",
    "인데",
    "거든요",
    "거든",
    "으로",
    "와",
    "과",
    "에서",
    "에게",
    "부터",
    "까지",
    "으로만",
    "로만",
    "에만",
    "에는",
    "은",
    "는",
    "이",
    "가",
    "을",
    "를",
    "도",
    "요",
)


def extract_issue_caselets(conversation: Conversation) -> list[dict[str, Any]]:
    if not conversation.turns:
        return []
    boundaries = _boundary_indices(conversation.turns)
    output: list[dict[str, Any]] = []
    for caselet_index, (start, end) in enumerate(zip(boundaries, boundaries[1:]), start=1):
        segment_turns = conversation.turns[start:end]
        if not segment_turns:
            continue
        segment = replace(conversation, turns=tuple(segment_turns))
        canonical_text, customer_text, pii_count = apply_canonicalization(segment)
        if not customer_text.strip():
            continue
        signature = build_signature(segment)
        flow_events = tuple(infer_event(turn.text, turn.speaker_role) for turn in segment_turns)
        turn_event_details = [infer_event_detail(turn.text, turn.speaker_role) for turn in segment_turns]
        quality_flags = _source_quality_flags(segment_turns, customer_text)
        filtered = _is_filtered_caselet(quality_flags)
        output.append(
            {
                "caseletId": f"{conversation.conversation_id}#issue-{caselet_index:02d}",
                "conversationId": conversation.conversation_id,
                "datasetId": conversation.dataset_id,
                "turnStart": start,
                "turnEnd": end - 1,
                "customerIssueText": customer_text,
                "agentResolutionText": _agent_text(canonical_text, customer_text),
                "agentActionText": _agent_text(canonical_text, customer_text),
                "canonicalText": canonical_text,
                "flowSignature": [float(value) for value in signature.tolist()],
                "flowSignatureDim": FLOW_SIGNATURE_DIM,
                "flowEvents": list(flow_events),
                "turnEventDetails": turn_event_details,
                "outcome": infer_outcome(segment),
                "workflowSignal": infer_workflow_signal(segment),
                "evidenceTurnIds": [turn.turn_id for turn in segment_turns],
                "sourceQualityFlags": quality_flags,
                "filtered": filtered,
                "qualityScore": _caselet_quality_score(quality_flags),
                "qualityTier": _caselet_quality_tier(quality_flags),
                "actionObjectFrame": _action_object_frame(customer_text),
                "piiMaskCount": pii_count,
            }
        )
    return output


def _boundary_indices(turns: Sequence[ConversationTurn]) -> list[int]:
    boundaries = [0]
    segment_customer_text = ""
    for index in range(1, len(turns)):
        previous_turn = turns[index - 1]
        current_turn = turns[index]
        if current_turn.speaker_role == SPEAKER_ROLE_CUSTOMER:
            score = _boundary_score(previous_turn, current_turn, segment_customer_text)
            if score >= _BOUNDARY_THRESHOLD and index - boundaries[-1] >= _MIN_SEGMENT_TURNS:
                boundaries.append(index)
                segment_customer_text = current_turn.text
                continue
        if current_turn.speaker_role == SPEAKER_ROLE_CUSTOMER:
            segment_customer_text = f"{segment_customer_text} {current_turn.text}".strip()
    if boundaries[-1] != len(turns):
        boundaries.append(len(turns))
    return _merge_short_boundaries(boundaries)


def _boundary_score(
    previous_turn: ConversationTurn,
    current_turn: ConversationTurn,
    segment_customer_text: str,
) -> float:
    score = 0.0
    text = current_turn.text.casefold()
    if any(cue in text for cue in _NEW_ISSUE_CUES):
        score += 0.35
    if previous_turn.speaker_role == SPEAKER_ROLE_AGENT and _is_resolution_like(previous_turn.text):
        score += 0.20
    if _lexical_distance(segment_customer_text, current_turn.text) > 0.65:
        score += 0.30
    return score


def _is_resolution_like(text: str) -> bool:
    normalized = text.casefold()
    return any(cue in normalized for cue in _RESOLUTION_CUES)


def _lexical_distance(left: str, right: str) -> float:
    left_tokens = set(_tokens(left))
    right_tokens = set(_tokens(right))
    if not left_tokens or not right_tokens:
        return 0.0
    intersection = len(left_tokens.intersection(right_tokens))
    union = len(left_tokens.union(right_tokens))
    return 1.0 - (intersection / union if union else 0.0)


def _tokens(text: str) -> tuple[str, ...]:
    return tuple(token for token in _TOKEN_PATTERN.findall(text.casefold()) if len(token.replace("_", "")) > 1)


def _merge_short_boundaries(boundaries: list[int]) -> list[int]:
    if len(boundaries) <= 2:
        return boundaries
    merged = [boundaries[0]]
    for boundary in boundaries[1:-1]:
        if boundary - merged[-1] < _MIN_SEGMENT_TURNS:
            continue
        merged.append(boundary)
    if merged[-1] != boundaries[-1]:
        merged.append(boundaries[-1])
    return merged


def _agent_text(canonical_text: str, customer_text: str) -> str:
    if not canonical_text:
        return ""
    return canonical_text.replace(customer_text, "").strip() or canonical_text


def _source_quality_flags(turns: Sequence[ConversationTurn], customer_text: str | None = None) -> list[str]:
    flags: list[str] = []
    if len(turns) < _MIN_SEGMENT_TURNS:
        flags.append("short_caselet")
    if not any(turn.speaker_role == SPEAKER_ROLE_AGENT for turn in turns):
        flags.append("no_agent_turn")
    if customer_text is not None:
        flags.extend(_customer_issue_quality_flags(customer_text))
    return flags


def _customer_issue_quality_flags(customer_text: str) -> list[str]:
    tokens = _tokens(customer_text)
    if not tokens:
        return ["low_information_customer_issue"]
    informative_tokens = [token for token in tokens if _is_informative_customer_token(token)]
    flags: list[str] = []
    normalized_text = customer_text.casefold()
    if not informative_tokens:
        flags.append("low_information_customer_issue")
    if all(token in _ACKNOWLEDGEMENT_TERMS for token in tokens):
        flags.append("acknowledgement_only_customer_issue")
    if all(token in _GREETING_OR_CLOSING_TERMS or token in _ACKNOWLEDGEMENT_TERMS for token in tokens):
        flags.append("greeting_or_closing_only_customer_issue")
    if any(pattern.search(normalized_text) for pattern in _NO_FURTHER_REQUEST_PATTERNS):
        flags.append("no_further_request_customer_issue")
    if any(pattern.search(normalized_text) for pattern in _DEFER_OR_DECLINE_PATTERNS):
        flags.append("deferred_or_declined_customer_issue")
    return flags


def _is_informative_customer_token(token: str) -> bool:
    normalized = token.casefold().strip()
    if len(normalized) <= 1:
        return False
    if normalized in _ACKNOWLEDGEMENT_TERMS or normalized in _GREETING_OR_CLOSING_TERMS:
        return False
    if normalized in _PLACEHOLDER_TERMS:
        return False
    return True


def _is_filtered_caselet(flags: Sequence[str]) -> bool:
    return any(flag in _LOW_INFORMATION_FLAGS for flag in flags)


def _caselet_quality_score(flags: Sequence[str]) -> float:
    if _is_filtered_caselet(flags):
        return 0.0
    score = 1.0
    if "short_caselet" in flags:
        score -= 0.2
    if "no_agent_turn" in flags:
        score -= 0.2
    return max(0.0, round(score, 4))


def _caselet_quality_tier(flags: Sequence[str]) -> str:
    if _is_filtered_caselet(flags):
        return "D"
    if not flags:
        return "A"
    if "short_caselet" in flags or "no_agent_turn" in flags:
        return "C"
    return "B"


def _action_object_frame(customer_text: str) -> dict[str, object]:
    normalized = customer_text.casefold()
    action, action_confidence = _infer_action(normalized)
    intent_type, intent_confidence = _infer_intent_type(normalized)
    object_term = _infer_object_term(customer_text, action)
    object_quality = _object_quality_score(object_term, action)
    if object_quality < 0.35:
        object_term = ""
        object_quality = 0.0
    confidence = 0.20
    if action:
        confidence += 0.35 * action_confidence
    if object_term:
        confidence += 0.30 * object_quality
    if intent_type != "unknown":
        confidence += 0.15 * intent_confidence
    return {
        "domain": None,
        "object": object_term,
        "action": action,
        "constraint": _infer_constraint(normalized),
        "intentType": intent_type,
        "objectQuality": round(object_quality, 4),
        "confidence": round(min(1.0, confidence), 4),
        "evidenceSpan": customer_text[:180],
    }


def _infer_action(normalized_text: str) -> tuple[str, float]:
    if re.search(r"어떤\s*정보|필요한\s*정보|무슨\s*정보", normalized_text):
        return "정보확인", 1.0
    if _is_price_information_question(normalized_text):
        return "정보확인", 0.9
    for action, pattern in _ACTION_PATTERNS:
        if pattern.search(normalized_text):
            return action, 1.0
    return "", 0.0


def _is_price_information_question(normalized_text: str) -> bool:
    has_price_topic = re.search(r"가격|요금|비용|금액|얼마|택스|수수료", normalized_text)
    has_information_cue = re.search(r"궁금|어떻게\s*되|얼마|알려|안내|문의", normalized_text)
    has_explicit_workflow_action = re.search(
        r"예약|결제\s*(문의|하려|하고|해|할|내역|확인)|납부\s*(문의|하려|하고|해|할|내역|확인)",
        normalized_text,
    )
    has_transaction_cue = re.search(
        r"결제\s*(했|되었|완료|오류|실패|취소|승인)|납부\s*(했|완료|오류|실패)",
        normalized_text,
    )
    return bool(
        has_price_topic and has_information_cue and not has_explicit_workflow_action and not has_transaction_cue
    )


def _infer_intent_type(normalized_text: str) -> tuple[str, float]:
    for intent_type, pattern in _INTENT_TYPE_PATTERNS:
        if pattern.search(normalized_text):
            return intent_type, 1.0
    if normalized_text.endswith("?") or "?" in normalized_text:
        return "question", 0.5
    return "unknown", 0.0


def _infer_object_term(customer_text: str, action: str) -> str:
    compound_candidate = _compound_action_object_candidate(customer_text, action)
    if compound_candidate:
        return compound_candidate

    phrase_candidate = _object_phrase_candidate(customer_text, action)
    if phrase_candidate:
        return phrase_candidate

    candidates: list[str] = []
    for token in _tokens(customer_text):
        normalized = _normalize_frame_token(token)
        if not _is_object_candidate(normalized, action):
            continue
        candidates.append(normalized)
    if not candidates:
        return ""
    ranked = sorted(enumerate(candidates), key=lambda item: (-len(item[1]), item[0]))
    return ranked[0][1]


def _compound_action_object_candidate(customer_text: str, action: str) -> str:
    if not action:
        return ""
    normalized_action = action.casefold()
    for token in _tokens(customer_text):
        normalized = _normalize_frame_token(token)
        if len(normalized) <= len(normalized_action) + 1:
            continue
        if not normalized.endswith(normalized_action):
            continue
        object_candidate = normalized[: -len(normalized_action)]
        if _is_object_candidate(object_candidate, ""):
            return object_candidate
    return ""


def _object_phrase_candidate(customer_text: str, action: str) -> str:
    normalized_text = customer_text.casefold()
    candidates: list[str] = []
    for clause in re.split(r"[.?!,;]|그리고|그럼|그러면|마지막으로|추가로", normalized_text):
        clause = clause.strip()
        if not clause:
            continue
        for pattern in _OBJECT_PHRASE_PATTERNS:
            for match in pattern.finditer(clause):
                candidate = _clean_frame_phrase(match.group("object"), action)
                if candidate:
                    candidates.append(candidate)
    if not candidates:
        return ""
    combined_candidate = _combined_object_phrase_candidate(candidates, action)
    if combined_candidate:
        return combined_candidate
    ranked = sorted(
        enumerate(candidates),
        key=lambda item: (-_object_phrase_score(item[1]), item[0]),
    )
    return ranked[0][1]


def _combined_object_phrase_candidate(candidates: list[str], action: str) -> str:
    if len(candidates) < 2:
        return ""
    terms: list[str] = []
    for candidate in candidates:
        for term in candidate.split():
            if term not in terms and _is_object_candidate(term, action):
                terms.append(term)
    if len(terms) < 2:
        return ""
    phrase = " ".join(terms[-3:])
    return phrase if _is_object_candidate(phrase.replace(" ", ""), action) else ""


def _clean_frame_phrase(value: str, action: str) -> str:
    cleaned_tokens: list[str] = []
    for token in _tokens(value):
        normalized = _normalize_frame_token(token)
        if _is_object_candidate(normalized, action):
            cleaned_tokens.append(normalized)
    if not cleaned_tokens:
        return ""
    deduped: list[str] = []
    for token in cleaned_tokens[-3:]:
        if token not in deduped:
            deduped.append(token)
    phrase = " ".join(deduped).strip()
    return phrase if _is_object_candidate(phrase.replace(" ", ""), action) else ""


def _object_phrase_score(value: str) -> float:
    tokens = value.split()
    score = float(min(4, len(tokens)))
    if any(
        token in value for token in ("상품", "서비스", "요금", "가격", "비용", "일정", "날짜", "금액", "상태", "내역")
    ):
        score += 1.0
    if any(_is_weak_frame_object_token(token) for token in tokens):
        score -= 0.5
    if len(value) <= 2:
        score -= 1.0
    return score


def _normalize_frame_token(token: str) -> str:
    normalized = token.strip().casefold()
    for _ in range(3):
        before = normalized
        for suffix in _FRAME_SUFFIXES:
            if normalized.endswith(suffix) and len(normalized) > len(suffix) + 1:
                normalized = normalized[: -len(suffix)]
                break
        if normalized == before:
            break
    if normalized.startswith("돈"):
        return "금액"
    if normalized.startswith("얼마") or normalized.startswith("얼만"):
        return "금액"
    if normalized.startswith("값"):
        return "금액"
    return normalized


def _is_object_candidate(normalized: str, action: str) -> bool:
    if not normalized or len(normalized.replace("_", "").replace(" ", "")) <= 1:
        return False
    if action:
        normalized_action = action.casefold()
        if normalized == normalized_action or normalized_action in normalized:
            return False
    if (
        normalized in _FRAME_STOPWORDS
        or normalized in _PLACEHOLDER_TERMS
        or normalized in _ACKNOWLEDGEMENT_TERMS
        or normalized in _GREETING_OR_CLOSING_TERMS
    ):
        return False
    if any(term and term in _FRAME_STOPWORDS for term in normalized.split()):
        meaningful = [term for term in normalized.split() if term not in _FRAME_STOPWORDS]
        if not meaningful:
            return False
    if any(char.isdigit() for char in normalized):
        return False
    if re.fullmatch(r"[a-z]{1,3}", normalized):
        return False
    if _is_weak_frame_object_token(normalized):
        return False
    if re.search(r"(?:것|걸)(?:만|로)?$", normalized):
        return False
    return True


def _object_quality_score(object_term: str, action: str) -> float:
    if not object_term:
        return 0.0
    tokens = tuple(token for token in object_term.split() if token)
    if not tokens or all(_is_weak_frame_object_token(token) for token in tokens):
        return 0.0
    score = 0.50
    if len(tokens) >= 2:
        score += 0.18
    if any(
        token in object_term
        for token in ("상품", "서비스", "요금", "가격", "비용", "일정", "날짜", "금액", "상태", "내역")
    ):
        score += 0.17
    if len(object_term.replace(" ", "")) >= 4:
        score += 0.10
    if action and action.casefold() in object_term.casefold():
        score -= 0.20
    weak_ratio = sum(1 for token in tokens if _is_weak_frame_object_token(token)) / len(tokens)
    score -= 0.30 * weak_ratio
    return max(0.0, min(1.0, score))


def _is_weak_frame_object_token(token: str) -> bool:
    normalized = token.strip().casefold()
    if (
        not normalized
        or normalized in _FRAME_STOPWORDS
        or normalized in _PLACEHOLDER_TERMS
        or normalized in _ACKNOWLEDGEMENT_TERMS
        or normalized in _GREETING_OR_CLOSING_TERMS
    ):
        return True
    return any(
        normalized.endswith(suffix)
        for suffix in (
            "해야",
            "가서",
            "어서",
            "아서",
            "면서",
            "는구나",
            "구나",
            "네요",
            "는데",
            "은데",
            "았는데",
            "었는데",
            "게",
            "걸로",
            "하나요",
            "할까요",
            "있나요",
            "없나요",
            "있는지",
            "없는지",
            "되면",
            "되",
            "하면",
            "하고",
            "해서",
            "려고",
            "도록",
            "했거든",
            "했거든요",
            "했는데",
            "했어요",
            "해가지고",
            "가지고",
            "떠가지고",
            "나와서",
            "떠서",
            "다가",
        )
    )


def _infer_constraint(normalized_text: str) -> str:
    if re.search(r"가능|되나요|할\s*수", normalized_text):
        return "availability_check"
    if re.search(r"불가|안\s*되|못\s*하", normalized_text):
        return "unavailable_or_failed"
    if re.search(r"정책|규정|조건|기준", normalized_text):
        return "policy_condition"
    return ""


__all__ = ["extract_issue_caselets"]
