from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.stages.intent_discovery.boundary_segments import (
    ACTION_AVAILABILITY,
    ACTION_CHANGE,
    ACTION_GENERAL,
    ACTION_INFO,
    ACTION_PAYMENT,
    ACTION_QUOTE,
    ACTION_REFUND,
    ACTION_RESERVATION,
    ACTION_SCHEDULE,
    INTENT_MISC,
    BoundarySegment,
    IntentLabel,
    _balanced_action,
    _balanced_cluster_row,
    _balanced_key,
    _classify_label,
    _cluster_result,
    _is_detail_continuation,
    _merge_label,
    _should_start_new_segment,
)
from pipeline.stages.intent_discovery.main import _run_boundary_segment, _run_legacy_embedding
from pipeline.stages.preprocessing.types import FLOW_SIGNATURE_DIM


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("예약을 취소하고 환불받고 싶어요", ACTION_REFUND),
        ("날짜를 변경하고 인원을 추가하고 싶어요", ACTION_CHANGE),
        ("계좌로 입금해도 되나요?", ACTION_PAYMENT),
        ("총 견적과 비용이 궁금합니다", ACTION_QUOTE),
        ("프로모션 할인 혜택 있나요?", "할인/혜택 문의"),
        ("상품 추천과 비교를 부탁드립니다", "추천/비교 문의"),
        ("여권 서류 정보가 필요합니다", ACTION_INFO),
        ("예약 가능 여부 확인 부탁드립니다", ACTION_AVAILABILITY),
        ("예약 신청 진행하고 싶어요", ACTION_RESERVATION),
        ("체크인 시간은 몇 시인가요?", ACTION_SCHEDULE),
        ("담당자 연락처와 이메일 알려주세요", "상담 연락 문의"),
        ("불만 보상 컴플레인 처리 원합니다", "문제 해결/보상 문의"),
        ("안녕하세요", ACTION_GENERAL),
    ],
)
def test_balanced_action_classifies_expected_action(text: str, expected: str) -> None:
    assert _balanced_action(text) == expected


def test_balanced_key_maps_common_domain_actions() -> None:
    assert _balanced_key("공통", ACTION_REFUND) == "예약 취소/환불 문의"
    assert _balanced_key("공통", ACTION_CHANGE) == "예약 변경 문의"
    assert _balanced_key("공통", ACTION_QUOTE) == ACTION_QUOTE
    assert _balanced_key("공통", ACTION_AVAILABILITY) == "예약 진행/가능 여부 문의"
    assert _balanced_key("공통", ACTION_RESERVATION) == ACTION_RESERVATION
    assert _balanced_key("공통", ACTION_SCHEDULE) == ACTION_SCHEDULE
    assert _balanced_key("공통", ACTION_GENERAL) == INTENT_MISC
    assert _balanced_key("숙소", ACTION_PAYMENT) == ACTION_PAYMENT
    assert _balanced_key("숙소", ACTION_CHANGE) == "숙소 변경 문의"


def test_boundary_decision_keeps_detail_or_general_continuations_together() -> None:
    current = IntentLabel("숙소", ACTION_PAYMENT, ACTION_PAYMENT, 0.9)
    detail = IntentLabel("공통", ACTION_GENERAL, INTENT_MISC, 0.7)
    changed = IntentLabel("숙소", ACTION_REFUND, ACTION_REFUND, 0.9)

    assert _should_start_new_segment(detail, current, "성인 2명 아이 1명입니다") is False
    assert _should_start_new_segment(changed, current, "예약 취소하고 환불하고 싶어요") is True


def test_merge_label_promotes_general_to_specific_and_keeps_availability_over_quote() -> None:
    general = IntentLabel("공통", ACTION_GENERAL, INTENT_MISC, 0.7)
    specific = IntentLabel("숙소", ACTION_CHANGE, "숙소 변경 문의", 0.9)
    availability = IntentLabel("숙소", ACTION_AVAILABILITY, "숙소 가능 여부/확인 문의", 0.9)
    quote = IntentLabel("숙소", ACTION_QUOTE, "숙소 가격/견적 문의", 0.9)

    assert _merge_label(general, specific) == specific
    assert _merge_label(availability, quote) == availability


def test_classify_label_marks_generic_text_as_misc_intent() -> None:
    label = _classify_label("안녕하세요")

    assert label.domain == "공통"
    assert label.action == ACTION_GENERAL
    assert label.canonical_intent == INTENT_MISC
    assert label.confidence == pytest.approx(0.7)


def test_cluster_rows_keep_unique_consultation_ids_and_misc_fallback() -> None:
    segments = [
        _segment("c1", "seg-1", 0, "안녕하세요"),
        _segment("c1", "seg-2", 1, "추가 문의입니다"),
        _segment("c2", "seg-3", 0, "다른 문의입니다"),
    ]
    segment_rows = [
        {
            "segment_id": segment.segment_id,
            "canonical_intent": INTENT_MISC,
            "segment_customer_text": segment.segment_customer_text,
        }
        for segment in segments
    ]

    balanced_row = _balanced_cluster_row(INTENT_MISC, 0, segments)
    cluster = _cluster_result(INTENT_MISC, 0, segments, segment_rows)

    assert balanced_row["fallback_name"] is True
    assert cluster.member_conv_ids == ("c1", "c2")
    assert cluster.exemplar_conv_ids == ("c1", "c2")
    assert cluster.metadata is not None
    assert cluster.metadata["fallback_name"] is True
    assert cluster.metadata["segment_ids"] == ["seg-1", "seg-2", "seg-3"]


def test_detail_continuation_allows_detail_without_new_action() -> None:
    assert _is_detail_continuation("성인 2명 아이 1명 여권 이름 전달드립니다") is True
    assert _is_detail_continuation("2명 예약을 취소하고 환불하고 싶어요") is False


def test_run_boundary_segment_returns_manifest_path(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context()
    _write_preprocessed(runtime_config, context, [_preprocessed_payload("c1", "예약 가능 여부 확인 부탁드립니다")])

    result = _run_boundary_segment(runtime_config, context)

    manifest_path = Path(cast(str, result["artifact_manifest_path"]))
    assert manifest_path.name == "manifest.json"
    assert manifest_path.exists()


def test_run_legacy_embedding_returns_manifest_for_empty_input(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context()
    _write_preprocessed(runtime_config, context, [])

    result = _run_legacy_embedding(runtime_config, context)

    manifest_path = Path(cast(str, result["artifact_manifest_path"]))
    assert manifest_path.name == "manifest.json"
    assert manifest_path.exists()


def _segment(consultation_id: str, segment_id: str, segment_index: int, text: str) -> BoundarySegment:
    return BoundarySegment(
        consultation_id=consultation_id,
        segment_id=segment_id,
        segment_index=segment_index,
        start_turn=segment_index,
        end_turn=segment_index,
        turn_indices=(segment_index,),
        turn_texts=(text,),
        segment_customer_text=text,
        intent_phrase=INTENT_MISC,
        intent_phrase_refined=INTENT_MISC,
        canonical_intent=INTENT_MISC,
        confidence=0.7,
    )


def _runtime_config(tmp_path: Path) -> PipelineRuntimeConfig:
    return PipelineRuntimeConfig(artifact_root=tmp_path / "artifacts", backend_base_url="http://backend:8080")


def _context() -> StageContext:
    return StageContext(
        dag_id="dag",
        run_id="run1",
        stage_name="intent_discovery",
        workspace_id="ws1",
        dataset_id="ds1",
    )


def _write_preprocessed(
    runtime_config: PipelineRuntimeConfig,
    context: StageContext,
    conversations: list[dict[str, Any]],
) -> None:
    upstream_context = StageContext(
        dag_id=context.dag_id,
        run_id=context.run_id,
        stage_name="preprocessing",
        workspace_id=context.workspace_id,
        dataset_id=context.dataset_id,
    )
    artifact_dir = upstream_context.artifact_dir(runtime_config)
    artifact_dir.mkdir(parents=True)
    (artifact_dir / "preprocessed_data.json").write_text(
        json.dumps({"schema_version": "1.0", "conversations": conversations}),
        encoding="utf-8",
    )


def _preprocessed_payload(conversation_id: str, text: str) -> dict[str, Any]:
    return {
        "id": conversation_id,
        "dataset_id": "ds1",
        "channel": "web",
        "ended_status": "resolved",
        "canonical_text": text,
        "customer_problem_text": text,
        "flow_signature": [0.0] * FLOW_SIGNATURE_DIM,
        "flow_signature_dim": FLOW_SIGNATURE_DIM,
        "turn_count": 1,
        "customer_turn_count": 1,
        "pii_mask_count": 0,
        "filtered": False,
    }
