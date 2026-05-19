from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.intent_discovery.types import ClusterQuality, ClusterResult, IntentDiscoveryStats
from pipeline.stages.preprocessing.io import read_ingestion_artifact
from pipeline.stages.preprocessing.types import Conversation, ConversationTurn, ProcessedConversation

SEGMENT_ARTIFACT = "intent_segments_v3.jsonl"
SENTENCE_ARTIFACT = "intent_sentence_mapping_v3.jsonl"
BALANCED_CLUSTER_ARTIFACT = "intent_clusters_v3_balanced.jsonl"
SOURCE_NAME = "balanced_defragmentation_v1"

ACTION_PAYMENT = "결제/입금 문의"
ACTION_DISCOUNT = "할인/혜택 문의"
ACTION_CONTACT = "상담 연락 문의"
ACTION_INFO = "정보/서류 문의"
ACTION_PROBLEM = "문제 해결/보상 문의"
ACTION_REFUND = "취소/환불 문의"
ACTION_CHANGE = "변경 문의"
ACTION_QUOTE = "가격/견적 문의"
ACTION_RECOMMEND = "추천/비교 문의"
ACTION_AVAILABILITY = "가능 여부/확인 문의"
ACTION_RESERVATION = "예약/신청 문의"
ACTION_SCHEDULE = "일정/기간 문의"
ACTION_GENERAL = "일반 문의"
INTENT_MISC = "기타 문의"

_COMMON_ACTION_INTENTS = {
    ACTION_PAYMENT,
    ACTION_DISCOUNT,
    ACTION_CONTACT,
    ACTION_INFO,
    ACTION_PROBLEM,
}
_STRONG_BOUNDARY_ACTIONS = {
    ACTION_REFUND,
    ACTION_CHANGE,
    ACTION_PAYMENT,
    ACTION_INFO,
    ACTION_PROBLEM,
}


@dataclass(frozen=True)
class IntentLabel:
    domain: str
    action: str
    canonical_intent: str
    confidence: float


@dataclass(frozen=True)
class BoundarySegment:
    consultation_id: str
    segment_id: str
    segment_index: int
    start_turn: int
    end_turn: int
    turn_indices: tuple[int, ...]
    turn_texts: tuple[str, ...]
    segment_customer_text: str
    intent_phrase: str
    intent_phrase_refined: str
    canonical_intent: str
    confidence: float


@dataclass(frozen=True)
class BoundaryDiscoveryResult:
    clusters: list[ClusterResult]
    segments: list[BoundarySegment]
    segment_rows: list[dict[str, object]]
    sentence_rows: list[dict[str, object]]
    balanced_rows: list[dict[str, object]]
    stats: IntentDiscoveryStats
    embeddings: np.ndarray


@dataclass
class _OpenSegment:
    consultation_id: str
    segment_index: int
    start_turn: int
    end_turn: int
    label: IntentLabel
    turn_indices: list[int]
    turn_texts: list[str]


def load_ingestion_conversation_index(
    runtime_config: PipelineRuntimeConfig,
    context: StageContext,
    preprocessed: Sequence[ProcessedConversation],
) -> dict[str, Conversation]:
    manifest_path = _stage_dir("ingestion", runtime_config, context) / "manifest.json"
    if manifest_path.exists():
        try:
            return {
                conversation.conversation_id: conversation
                for conversation in read_ingestion_artifact(str(manifest_path))
            }
        except PipelineStageError:
            raise
        except OSError as exc:
            raise PipelineStageError(f"Failed to read ingestion conversations: {manifest_path}") from exc

    return {
        conversation.id: _fallback_conversation_from_preprocessed(conversation)
        for conversation in preprocessed
        if _fallback_text(conversation)
    }


def discover_boundary_segments(conversations: Sequence[Conversation]) -> BoundaryDiscoveryResult:
    segments = _segment_conversations(conversations)
    groups = _group_segments(segments)
    canonical_order = _canonical_order(segments, groups)
    cluster_id_by_intent = {canonical: index for index, canonical in enumerate(canonical_order)}

    segment_rows = [_segment_row(segment, cluster_id_by_intent[segment.canonical_intent]) for segment in segments]
    sentence_rows = [
        sentence_row
        for segment in segments
        for sentence_row in _sentence_rows(segment, cluster_id_by_intent[segment.canonical_intent])
    ]
    balanced_rows = [
        _balanced_cluster_row(canonical, cluster_id_by_intent[canonical], groups[canonical])
        for canonical in canonical_order
    ]
    clusters = [
        _cluster_result(canonical, cluster_id_by_intent[canonical], groups[canonical], segment_rows)
        for canonical in canonical_order
    ]
    stats = _stats(segments, clusters)
    embeddings = np.zeros((max(len(segments), 1), 1), dtype=np.float32)
    if not segments:
        embeddings = np.zeros((0, 1), dtype=np.float32)

    return BoundaryDiscoveryResult(
        clusters=clusters,
        segments=segments,
        segment_rows=segment_rows,
        sentence_rows=sentence_rows,
        balanced_rows=balanced_rows,
        stats=stats,
        embeddings=embeddings,
    )


def write_boundary_artifacts(output_dir: Path, result: BoundaryDiscoveryResult) -> dict[str, object]:
    segment_path = output_dir / SEGMENT_ARTIFACT
    sentence_path = output_dir / SENTENCE_ARTIFACT
    balanced_path = output_dir / BALANCED_CLUSTER_ARTIFACT

    _write_jsonl(segment_path, result.segment_rows)
    _write_jsonl(sentence_path, result.sentence_rows)
    _write_jsonl(balanced_path, result.balanced_rows)

    return {
        "segment_artifact_path": segment_path.name,
        "sentence_artifact_path": sentence_path.name,
        "balanced_cluster_artifact_path": balanced_path.name,
        "segment_count": len(result.segment_rows),
        "sentence_mapping_count": len(result.sentence_rows),
        "balanced_cluster_count": len(result.balanced_rows),
        "discovery_mode": "boundary_segment_v1",
    }


def _segment_conversations(conversations: Sequence[Conversation]) -> list[BoundarySegment]:
    segments: list[BoundarySegment] = []
    for conversation in conversations:
        segments.extend(_segment_conversation(conversation))
    return segments


def _segment_conversation(conversation: Conversation) -> list[BoundarySegment]:
    open_segment: _OpenSegment | None = None
    segments: list[BoundarySegment] = []

    for fallback_index, turn in enumerate(conversation.turns):
        if not _is_customer_turn(turn):
            continue
        text = _normalize_text(turn.text)
        if not text:
            continue

        turn_index = _turn_index(turn, fallback_index)
        label = _classify_label(text)
        if open_segment is None:
            open_segment = _start_segment(conversation.conversation_id, len(segments), turn_index, text, label)
            continue

        if _should_start_new_segment(label, open_segment.label, text):
            segments.append(_close_segment(open_segment))
            open_segment = _start_segment(conversation.conversation_id, len(segments), turn_index, text, label)
            continue

        open_segment.end_turn = turn_index
        open_segment.turn_indices.append(turn_index)
        open_segment.turn_texts.append(text)
        open_segment.label = _merge_label(open_segment.label, label)

    if open_segment is not None:
        segments.append(_close_segment(open_segment))
    return segments


def _start_segment(
    consultation_id: str,
    segment_index: int,
    turn_index: int,
    text: str,
    label: IntentLabel,
) -> _OpenSegment:
    return _OpenSegment(
        consultation_id=consultation_id,
        segment_index=segment_index,
        start_turn=turn_index,
        end_turn=turn_index,
        label=label,
        turn_indices=[turn_index],
        turn_texts=[text],
    )


def _close_segment(segment: _OpenSegment) -> BoundarySegment:
    segment_id = f"{segment.consultation_id}__seg{segment.segment_index:03d}"
    segment_text = "\n".join(segment.turn_texts)
    canonical = segment.label.canonical_intent
    return BoundarySegment(
        consultation_id=segment.consultation_id,
        segment_id=segment_id,
        segment_index=segment.segment_index,
        start_turn=segment.start_turn,
        end_turn=segment.end_turn,
        turn_indices=tuple(segment.turn_indices),
        turn_texts=tuple(segment.turn_texts),
        segment_customer_text=segment_text,
        intent_phrase=canonical,
        intent_phrase_refined=canonical,
        canonical_intent=canonical,
        confidence=segment.label.confidence,
    )


def _should_start_new_segment(label: IntentLabel, current: IntentLabel, text: str) -> bool:
    if _is_ack_or_closing(text):
        return False
    if _is_detail_continuation(text) and label.domain == "공통":
        return False
    if label.domain != "공통" and current.domain != "공통" and label.domain != current.domain:
        return True
    if label.action in _STRONG_BOUNDARY_ACTIONS and label.action != current.action:
        return True
    if current.action in _STRONG_BOUNDARY_ACTIONS and label.action != current.action:
        return label.action not in {ACTION_GENERAL, ACTION_AVAILABILITY, ACTION_INFO}
    return False


def _merge_label(current: IntentLabel, incoming: IntentLabel) -> IntentLabel:
    if current.domain == "공통" and incoming.domain != "공통":
        return incoming
    if current.action == ACTION_GENERAL and incoming.action != ACTION_GENERAL:
        return incoming
    if current.domain == incoming.domain and current.action == ACTION_AVAILABILITY and incoming.action == ACTION_QUOTE:
        return current
    return current


def _classify_label(text: str) -> IntentLabel:
    normalized = _normalize_text(text)
    domain = _balanced_domain(normalized)
    action = _balanced_action(normalized)
    canonical = _balanced_key(domain, action)
    confidence = 0.92
    if domain == "공통":
        confidence -= 0.1
    if action == ACTION_GENERAL:
        confidence -= 0.12
    if _is_detail_continuation(normalized):
        confidence -= 0.08
    return IntentLabel(domain=domain, action=action, canonical_intent=canonical, confidence=max(confidence, 0.62))


def _balanced_domain(text: str) -> str:
    if re.search(r"픽업|샌딩|공항|차량|택시|교통|이동|미팅", text):
        return "공항 픽업/이동"
    if re.search(r"항공|항공권|비행|항공편|발권|좌석|경유|출국|귀국|수하물", text):
        return "항공권"
    if re.search(r"호텔|숙소|리조트|풀빌라|객실|방|룸|빌라|조식|침대|버틀러|체크인|체크아웃", text):
        return "숙소"
    if re.search(r"투어|액티비티|옵션|마사지|스냅|가이드|관광|지프|래프팅|스노클링|런치뷔페", text):
        return "투어/옵션"
    if re.search(r"허니문|신혼여행|여행|상품|패키지|일정|코스|발리|푸켓|몰디브", text):
        return "여행상품"
    return "공통"


def _balanced_action(text: str) -> str:
    if re.search(r"취소|해지|환불|환급|캔슬", text):
        return ACTION_REFUND
    if re.search(r"변경|수정|연장|단축|바꾸|추가|인원.*변경|날짜.*변경", text):
        return ACTION_CHANGE
    if re.search(r"결제|입금|카드|현금영수증|계좌|송금|납부|잔금|환전|결제방법", text):
        return ACTION_PAYMENT
    if re.search(r"견적|가격|금액|요금|비용|총액|얼마|예산|가견적|숙박비", text):
        return ACTION_QUOTE
    if re.search(r"혜택|할인|프로모션|특전|이벤트|쿠폰|조기", text):
        return ACTION_DISCOUNT
    if re.search(r"추천|소개|골라|비교|선택|좋은|어디", text):
        return ACTION_RECOMMEND
    if re.search(r"준비물|서류|여권|비자|정보|필요|제출|작성", text):
        return ACTION_INFO
    if re.search(r"가능|가능성|마감|대기|예약 가능|예약확인|확인|조회", text):
        return ACTION_AVAILABILITY
    if re.search(r"예약|신청|접수|진행|확정|예약금|발권", text):
        return ACTION_RESERVATION
    if re.search(r"일정|기간|날짜|몇박|며칠|시간|소요|출발|도착", text):
        return ACTION_SCHEDULE
    if re.search(r"연락|전화|메일|이메일|카카오|담당자|직통", text):
        return ACTION_CONTACT
    if re.search(r"불만|문제|보상|도움|해결|컴플레인", text):
        return ACTION_PROBLEM
    return ACTION_GENERAL


def _balanced_key(domain: str, action: str) -> str:
    if action in _COMMON_ACTION_INTENTS:
        return action
    if domain == "공통":
        return {
            ACTION_REFUND: "예약 취소/환불 문의",
            ACTION_CHANGE: "예약 변경 문의",
            ACTION_QUOTE: ACTION_QUOTE,
            ACTION_AVAILABILITY: "예약 진행/가능 여부 문의",
            ACTION_RESERVATION: ACTION_RESERVATION,
            ACTION_RECOMMEND: "상품 추천/비교 문의",
            ACTION_SCHEDULE: ACTION_SCHEDULE,
            ACTION_GENERAL: INTENT_MISC,
        }.get(action, action)
    return f"{domain} {action}"


def _group_segments(segments: Sequence[BoundarySegment]) -> dict[str, list[BoundarySegment]]:
    groups: dict[str, list[BoundarySegment]] = defaultdict(list)
    for segment in segments:
        groups[segment.canonical_intent].append(segment)
    return groups


def _canonical_order(
    segments: Sequence[BoundarySegment],
    groups: Mapping[str, Sequence[BoundarySegment]],
) -> list[str]:
    first_seen = {segment.canonical_intent: index for index, segment in reversed(list(enumerate(segments)))}
    return sorted(groups, key=lambda canonical: (-len(groups[canonical]), first_seen[canonical], canonical))


def _balanced_cluster_row(
    canonical: str,
    cluster_id: int,
    segments: Sequence[BoundarySegment],
) -> dict[str, object]:
    phrases = [phrase for phrase, _count in Counter(s.intent_phrase_refined for s in segments).most_common(8)]
    return {
        "canonical_intent": canonical,
        "description": _description(canonical),
        "fallback_name": canonical == INTENT_MISC,
        "cluster_id": cluster_id,
        "cluster_size": len(segments),
        "sample_intent_phrases": phrases,
        "source": SOURCE_NAME,
    }


def _cluster_result(
    canonical: str,
    cluster_id: int,
    segments: Sequence[BoundarySegment],
    segment_rows: Sequence[Mapping[str, object]],
) -> ClusterResult:
    segment_ids = [segment.segment_id for segment in segments]
    member_conv_ids = _unique_tuple(segment.consultation_id for segment in segments)
    exemplar_conv_ids = member_conv_ids[:3]
    keywords = tuple(_positive_keywords(canonical))
    quality = ClusterQuality(
        interpretability_score=min(0.95, 0.7 + 0.03 * len(keywords)),
        workflow_consistency_score=min(0.95, 0.72 + 0.02 * len(segments)),
        branching_explainability_score=None,
    )
    samples = [
        str(row["segment_customer_text"])
        for row in segment_rows
        if row.get("canonical_intent") == canonical and row.get("segment_customer_text")
    ][:5]
    return ClusterResult(
        cluster_id=cluster_id,
        member_indices=tuple(_segment_global_index(segment.segment_id, segment_rows) for segment in segments),
        member_conv_ids=member_conv_ids,
        exemplar_conv_ids=exemplar_conv_ids,
        keywords=keywords,
        suggested_name=canonical,
        suggested_description=_description(canonical),
        workflow_signal=_workflow_signal(canonical),
        quality=quality,
        review_hint=None,
        metadata={
            "canonical_intent": canonical,
            "description": _description(canonical),
            "fallback_name": canonical == INTENT_MISC,
            "cluster_size": len(segments),
            "sample_intent_phrases": [segment.intent_phrase_refined for segment in segments[:8]],
            "sample_segment_texts": samples,
            "source": SOURCE_NAME,
            "segment_ids": list(segment_ids),
        },
    )


def _segment_global_index(segment_id: str, segment_rows: Sequence[Mapping[str, object]]) -> int:
    for index, row in enumerate(segment_rows):
        if row.get("segment_id") == segment_id:
            return index
    return -1


def _segment_row(segment: BoundarySegment, cluster_id: int) -> dict[str, object]:
    return {
        "consultation_id": segment.consultation_id,
        "segment_id": segment.segment_id,
        "segment_index": segment.segment_index,
        "start_turn": segment.start_turn,
        "end_turn": segment.end_turn,
        "segment_start_turn": segment.start_turn,
        "segment_end_turn": segment.end_turn,
        "segment_customer_text": segment.segment_customer_text,
        "exact_span": segment.segment_customer_text[:180],
        "intent_phrase": segment.intent_phrase,
        "intent_phrase_refined": segment.intent_phrase_refined,
        "canonical_intent": segment.canonical_intent,
        "cluster_id": cluster_id,
        "confidence": round(segment.confidence, 2),
        "second_pass_action": "unchanged",
    }


def _sentence_rows(segment: BoundarySegment, cluster_id: int) -> Iterable[dict[str, object]]:
    for turn_index, text in zip(segment.turn_indices, segment.turn_texts, strict=True):
        for sentence in _split_sentences(text):
            yield {
                "consultation_id": segment.consultation_id,
                "segment_id": segment.segment_id,
                "turn_index": turn_index,
                "sentence_text": sentence,
                "canonical_intent": segment.canonical_intent,
                "cluster_id": cluster_id,
                "inherited_from_segment": True,
            }


def _stats(segments: Sequence[BoundarySegment], clusters: Sequence[ClusterResult]) -> IntentDiscoveryStats:
    return IntentDiscoveryStats(
        input_count=len(segments),
        embedding_failed_count=0,
        cluster_count=len(clusters),
        outlier_count=0,
        outlier_rate=0.0,
        avg_interpretability_score=_avg([cluster.quality.interpretability_score for cluster in clusters]),
        avg_workflow_consistency_score=_avg([cluster.quality.workflow_consistency_score for cluster in clusters]),
    )


def _workflow_signal(canonical: str) -> dict[str, bool]:
    return {
        "requires_payment_check": bool(re.search(r"결제|입금|환불|가격|견적|요금|비용", canonical)),
        "requires_user_identification": bool(re.search(r"예약|변경|취소|환불|신청", canonical)),
        "has_escalation_cases": bool(re.search(r"문제|보상|불만|컴플레인", canonical)),
    }


def _description(canonical: str) -> str:
    return f"고객이 {canonical.replace(' 문의', '')}와 관련해 확인, 요청 또는 상담을 원하는 의도"


def _positive_keywords(canonical: str) -> list[str]:
    return [token for token in re.split(r"[ /]+", canonical.replace("문의", "")) if token]


def _stage_dir(stage_name: str, runtime_config: PipelineRuntimeConfig, context: StageContext) -> Path:
    return StageContext(
        dag_id=context.dag_id,
        run_id=context.run_id,
        stage_name=stage_name,
        workspace_id=context.workspace_id,
        dataset_id=context.dataset_id,
        pipeline_job_id=context.pipeline_job_id,
    ).artifact_dir(runtime_config)


def _fallback_conversation_from_preprocessed(conversation: ProcessedConversation) -> Conversation:
    text = _fallback_text(conversation)
    return Conversation(
        conversation_id=conversation.id,
        dataset_id=conversation.dataset_id,
        channel=conversation.channel,
        ended_status=conversation.ended_status,
        turns=(ConversationTurn(turn_id="turn_0", speaker_role="customer", text=text),),
    )


def _fallback_text(conversation: ProcessedConversation) -> str:
    return conversation.customer_problem_text or conversation.canonical_text


def _is_customer_turn(turn: ConversationTurn) -> bool:
    role = turn.speaker_role.strip().lower()
    return role in {"customer", "client", "c"} or "고객" in turn.speaker_role or "손님" in turn.speaker_role


def _turn_index(turn: ConversationTurn, fallback: int) -> int:
    reversed_digits = []
    for char in reversed(turn.turn_id):
        if not char.isdecimal():
            break
        reversed_digits.append(char)
    if not reversed_digits:
        return fallback
    return int("".join(reversed(reversed_digits)))


def _is_ack_or_closing(text: str) -> bool:
    return bool(re.fullmatch(r".*(감사|고맙|알겠|네|넵|확인했습니다|좋습니다)[!.。！\s]*", text)) and len(text) <= 40


def _is_detail_continuation(text: str) -> bool:
    detail_keywords = ("성인", "아동", "아이", "인원", "여권", "이름", "연락처")
    has_detail = _has_numbered_detail_unit(text) or any(keyword in text for keyword in detail_keywords)
    has_action = _balanced_action(text) not in {ACTION_GENERAL, ACTION_SCHEDULE, ACTION_INFO}
    return has_detail and not has_action


def _unique_tuple(values: Iterable[str]) -> tuple[str, ...]:
    return tuple(dict.fromkeys(values).keys())


def _has_numbered_detail_unit(text: str) -> bool:
    units = "명박일월시분"
    for index, char in enumerate(text):
        if not char.isdecimal():
            continue
        cursor = index + 1
        while cursor < len(text) and text[cursor].isspace():
            cursor += 1
        if cursor < len(text) and text[cursor] in units:
            return True
    return False


def _split_sentences(text: str) -> list[str]:
    sentences = [part.strip() for part in re.split(r"(?<=[.!?。？！])\s+|\n+", text) if part.strip()]
    return sentences or [text]


def _normalize_text(value: object) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\t ]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _write_jsonl(path: Path, rows: Iterable[Mapping[str, object]]) -> None:
    with path.open("w", encoding="utf-8") as output:
        for row in rows:
            output.write(json.dumps(dict(row), ensure_ascii=False, separators=(",", ":")) + "\n")


def _avg(values: Sequence[float]) -> float:
    return sum(values) / len(values) if values else 0.0
