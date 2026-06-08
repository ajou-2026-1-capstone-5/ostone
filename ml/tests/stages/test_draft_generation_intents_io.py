from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.draft_generation.main import (
    _build_intents,
    _hydrate_case,
    _read_clusters,
    _read_preprocessed_index,
    _resolve_cases_per_intent,
)
from tests.helpers.draft_generation import (
    _preprocessed_conv,
    _runtime_config,
    _stage_context,
    _write_clusters,
    _write_preprocessed,
)


def test_build_intents_full_hydration() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "환불 문의",
            "suggested_description": "환불 관련 클러스터",
            "exemplar_conv_ids": ["c1", "c2", "c3"],
            "keywords": ["환불", "취소"],
        }
    ]
    index = {
        "c1": _preprocessed_conv("c1", "환불 요청합니다", "환불"),
        "c2": _preprocessed_conv("c2", "주문 취소 원합니다", "취소"),
        "c3": _preprocessed_conv("c3", "refund please", "refund"),
    }

    intents, metrics = _build_intents(clusters, index, cases_per_intent=3)

    assert len(intents) == 1
    assert intents[0]["intentCode"] == "INTENT_0"
    assert intents[0]["name"] == "환불 문의"
    assert len(intents[0]["representativeCases"]) == 3
    assert metrics["intent_count"] == 1
    assert metrics["representative_case_total"] == 3
    assert metrics["intents_with_zero_cases"] == 0
    assert intents[0]["representativeCases"][0]["conversationId"] == "c1"
    assert intents[0]["representativeCases"][0]["canonicalText"] == "환불 요청합니다"
    assert intents[0]["representativeCases"][0]["customerProblemText"] == "환불"
    assert intents[0]["representativeCases"][0]["endedStatus"] == "resolved"
    assert json.loads(intents[0]["sourceClusterRef"])["keywords"] == ["환불", "취소"]


def test_build_intents_partial_hydration() -> None:
    clusters = [
        {
            "cluster_id": 1,
            "suggested_name": "배송 문의",
            "suggested_description": "배송 관련 클러스터",
            "exemplar_conv_ids": ["c1", "missing_id", "c2"],
        }
    ]
    index = {
        "c1": _preprocessed_conv("c1"),
        "c2": _preprocessed_conv("c2"),
    }

    intents, metrics = _build_intents(clusters, index, cases_per_intent=3)

    assert len(intents[0]["representativeCases"]) == 2
    assert metrics["representative_case_total"] == 2
    assert metrics["intents_with_zero_cases"] == 0


def test_build_intents_groups_duplicate_labels_as_parent_variants() -> None:
    clusters = [
        {
            "cluster_id": 10,
            "suggested_name": "카드 결제 문의",
            "suggested_description": "카드 결제 확인",
            "exemplar_conv_ids": ["caselet-a"],
            "segment_ids": ["caselet-a"],
            "workflow_signal": {"requires_payment_check": True},
            "flow_split_key": "requires_payment_check|action_object 카드 결제|sequence 확인질문",
            "label_score": 0.86,
            "label_validation_status": "auto_acceptable",
        },
        {
            "cluster_id": 11,
            "suggested_name": "카드 결제 문의",
            "suggested_description": "카드 결제 본인 확인",
            "exemplar_conv_ids": ["caselet-b"],
            "segment_ids": ["caselet-b"],
            "workflow_signal": {"requires_user_identification": True},
            "flow_split_key": "requires_user_identification+requires_payment_check|mixed_residual",
            "label_score": 0.84,
            "label_validation_status": "auto_acceptable",
        },
    ]
    index = {
        "caselet-a": _preprocessed_conv("caselet-a", "카드 결제 내역 확인해주세요", "카드 결제 확인"),
        "caselet-b": _preprocessed_conv("caselet-b", "카드 결제 때문에 본인확인 해야 하나요", "카드 결제 본인확인"),
    }

    intents, metrics = _build_intents(clusters, index, cases_per_intent=2)

    parent = intents[0]
    children = intents[1:]
    assert parent["intentCode"] == "PARENT_INTENT_0"
    assert parent["name"] == "카드 결제 문의"
    assert parent["taxonomyLevel"] == 1
    assert parent["parentIntentCode"] is None
    assert json.loads(parent["metaJson"])["intentRole"] == "parent_intent"
    assert {child["parentIntentCode"] for child in children} == {"PARENT_INTENT_0"}
    assert {child["taxonomyLevel"] for child in children} == {2}
    assert [child["name"] for child in children] == [
        "카드 결제 문의 - 결제확인·카드 결제·확인질문 변형 1",
        "카드 결제 문의 - 본인확인·결제확인·잔여 변형 2",
    ]
    assert all(json.loads(child["metaJson"])["intentRole"] == "workflow_variant" for child in children)
    assert metrics["intent_count"] == 3
    assert metrics["parent_intent_count"] == 1
    assert metrics["leaf_intent_count"] == 2
    assert metrics["workflow_variant_intent_count"] == 2
    assert metrics["variants_per_parent_intent_avg"] == 2.0
    assert metrics["variants_per_parent_intent_max"] == 2
    assert metrics["single_variant_intent_rate"] == 0.0


def test_build_intents_keeps_source_cluster_ref_under_callback_limit() -> None:
    member_ids = [f"caselet-{index}" for index in range(80)]
    clusters = [
        {
            "cluster_id": 10,
            "suggested_name": "예약 취소 문의",
            "suggested_description": "예약 취소",
            "exemplar_conv_ids": member_ids[:2],
            "segment_ids": member_ids,
            "workflow_signal": {"requires_payment_check": True},
            "flow_split_key": "requires_payment_check|action_object 예약 취소|sequence 정책안내",
        },
        {
            "cluster_id": 11,
            "suggested_name": "예약 취소 문의",
            "suggested_description": "예약 취소 본인확인",
            "exemplar_conv_ids": member_ids[2:4],
            "segment_ids": member_ids,
            "workflow_signal": {"requires_user_identification": True},
            "flow_split_key": "requires_user_identification|action_object 예약 취소|sequence 본인확인",
        },
    ]
    index = {
        member_id: {
            **_preprocessed_conv(
                member_id,
                canonical=("예약 취소 관련 상담 내용 " * 80),
                problem=("예약 취소 문의 " * 30),
            ),
            "caseletId": member_id,
            "conversationId": member_id.split("-")[-1],
            "actionObjectFrame": {
                "object": "예약",
                "action": "취소",
                "intentType": "request",
                "confidence": 0.9,
            },
            "flowEvents": ["정책안내", "본인확인", "추가정보요청"],
            "evidenceTurnIds": ["turn-1", "turn-2"],
        }
        for member_id in member_ids
    }

    intents, _metrics = _build_intents(clusters, index, cases_per_intent=2)

    assert all(len(intent["sourceClusterRef"]) <= 5000 for intent in intents)
    assert all(isinstance(json.loads(intent["sourceClusterRef"]), dict) for intent in intents)


def test_build_intents_empty_exemplar_conv_ids() -> None:
    clusters = [
        {
            "cluster_id": 2,
            "suggested_name": "미분류",
            "suggested_description": "미분류 클러스터",
            "exemplar_conv_ids": [],
        }
    ]
    index = {"c1": _preprocessed_conv("c1")}

    intents, metrics = _build_intents(clusters, index, cases_per_intent=3)

    assert intents[0]["representativeCases"] == []
    assert metrics["intents_with_zero_cases"] == 1


def test_build_intents_all_conv_ids_missing() -> None:
    clusters = [
        {
            "cluster_id": 3,
            "suggested_name": "문의",
            "suggested_description": "클러스터",
            "exemplar_conv_ids": ["missing1", "missing2"],
        }
    ]

    intents, metrics = _build_intents(clusters, {}, cases_per_intent=3)

    assert intents[0]["representativeCases"] == []
    assert metrics["intents_with_zero_cases"] == 1


def test_build_intents_cases_per_intent_limit() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "문의",
            "suggested_description": "클러스터",
            "exemplar_conv_ids": ["c1", "c2", "c3"],
        }
    ]
    index = {f"c{i}": _preprocessed_conv(f"c{i}") for i in range(1, 4)}

    intents, metrics = _build_intents(clusters, index, cases_per_intent=2)

    assert len(intents[0]["representativeCases"]) == 2
    assert metrics["representative_case_total"] == 2


def test_hydrate_case_maps_fields() -> None:
    conv = {
        "id": "conv_001",
        "canonical_text": "환불 요청",
        "customer_problem_text": "환불",
        "ended_status": "resolved",
    }

    case = _hydrate_case(conv)

    assert case["conversationId"] == "conv_001"
    assert case["canonicalText"] == "환불 요청"
    assert case["customerProblemText"] == "환불"
    assert case["endedStatus"] == "resolved"


def test_hydrate_case_null_ended_status() -> None:
    conv = {
        "id": "conv_002",
        "canonical_text": "문의",
        "customer_problem_text": "문의",
        "ended_status": None,
    }

    case = _hydrate_case(conv)

    assert case["endedStatus"] is None


def test_read_clusters_raises_when_missing(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _stage_context()

    with pytest.raises(PipelineStageError, match="clusters.json not found"):
        _read_clusters(runtime_config, context)


def test_read_preprocessed_index_raises_when_missing(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _stage_context()

    with pytest.raises(PipelineStageError, match="preprocessed_data.json not found"):
        _read_preprocessed_index(runtime_config, context)


def test_read_clusters_success(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _stage_context()
    clusters_dir = runtime_config.artifact_root / "dag" / "run1" / "intent_discovery"
    _write_clusters(clusters_dir, [{"cluster_id": 0, "exemplar_conv_ids": ["c1"]}])

    artifact = _read_clusters(runtime_config, context)

    assert len(artifact.clusters) == 1
    assert artifact.payload["clusters"] == artifact.clusters
    assert artifact.source_path == clusters_dir / "clusters.json"


def test_read_clusters_prefers_flow_splitting_artifact(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _stage_context()
    intent_dir = runtime_config.artifact_root / "dag" / "run1" / "intent_discovery"
    flow_dir = runtime_config.artifact_root / "dag" / "run1" / "flow_splitting"
    _write_clusters(intent_dir, [{"cluster_id": 0, "exemplar_conv_ids": ["intent"]}])
    _write_clusters(flow_dir, [{"cluster_id": 1, "exemplar_conv_ids": ["flow"]}])

    artifact = _read_clusters(runtime_config, context)

    assert artifact.clusters[0]["cluster_id"] == 1
    assert artifact.source_path == flow_dir / "clusters.json"


def test_read_clusters_raises_with_field_path_when_clusters_is_not_list(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _stage_context()
    clusters_dir = runtime_config.artifact_root / "dag" / "run1" / "intent_discovery"
    clusters_dir.mkdir(parents=True)
    (clusters_dir / "clusters.json").write_text(
        json.dumps({"schema_version": "1.0", "clusters": {"cluster_id": 0}}),
        encoding="utf-8",
    )

    with pytest.raises(PipelineStageError, match=r"clusters\.json field 'clusters' must be a list"):
        _read_clusters(runtime_config, context)


def test_read_clusters_raises_with_field_path_when_cluster_item_is_not_object(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _stage_context()
    clusters_dir = runtime_config.artifact_root / "dag" / "run1" / "intent_discovery"
    clusters_dir.mkdir(parents=True)
    (clusters_dir / "clusters.json").write_text(
        json.dumps({"schema_version": "1.0", "clusters": [{"cluster_id": 0}, "bad"]}),
        encoding="utf-8",
    )

    with pytest.raises(PipelineStageError, match=r"clusters\.json field 'clusters\[1\]' must be a JSON object"):
        _read_clusters(runtime_config, context)


def test_read_preprocessed_index_success(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _stage_context()
    preprocessed_dir = runtime_config.artifact_root / "dag" / "run1" / "preprocessing"
    _write_preprocessed(preprocessed_dir, [_preprocessed_conv("c1"), _preprocessed_conv("c2")])

    index = _read_preprocessed_index(runtime_config, context)

    assert set(index.keys()) == {"c1", "c2"}


def test_read_preprocessed_index_raises_with_field_path_when_conversations_is_not_list(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _stage_context()
    preprocessed_dir = runtime_config.artifact_root / "dag" / "run1" / "preprocessing"
    preprocessed_dir.mkdir(parents=True)
    (preprocessed_dir / "preprocessed_data.json").write_text(
        json.dumps({"schema_version": "1.0", "conversations": {"id": "c1"}}),
        encoding="utf-8",
    )

    with pytest.raises(
        PipelineStageError,
        match=r"preprocessed_data\.json field 'conversations' must be a list",
    ):
        _read_preprocessed_index(runtime_config, context)


def test_read_preprocessed_index_raises_with_field_path_when_conversation_id_is_missing(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _stage_context()
    preprocessed_dir = runtime_config.artifact_root / "dag" / "run1" / "preprocessing"
    preprocessed_dir.mkdir(parents=True)
    (preprocessed_dir / "preprocessed_data.json").write_text(
        json.dumps({"schema_version": "1.0", "conversations": [{"canonical_text": "text"}]}),
        encoding="utf-8",
    )

    with pytest.raises(
        PipelineStageError,
        match=r"preprocessed_data\.json field 'conversations\[0\]\.id' must be a non-empty string",
    ):
        _read_preprocessed_index(runtime_config, context)


def test_resolve_cases_per_intent_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DRAFT_REPRESENTATIVE_CASES_PER_INTENT", raising=False)

    assert _resolve_cases_per_intent() == 3


def test_resolve_cases_per_intent_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DRAFT_REPRESENTATIVE_CASES_PER_INTENT", "2")

    assert _resolve_cases_per_intent() == 2


def test_resolve_cases_per_intent_invalid_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DRAFT_REPRESENTATIVE_CASES_PER_INTENT", "not_a_number")

    assert _resolve_cases_per_intent() == 3


def test_build_intents_avg_per_intent() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "A",
            "suggested_description": "A클러스터",
            "exemplar_conv_ids": ["c1", "c2"],
        },
        {
            "cluster_id": 1,
            "suggested_name": "B",
            "suggested_description": "B클러스터",
            "exemplar_conv_ids": [],
        },
    ]
    index = {"c1": _preprocessed_conv("c1"), "c2": _preprocessed_conv("c2")}

    _intents, metrics = _build_intents(clusters, index, cases_per_intent=3)

    assert metrics["intent_count"] == 2
    assert metrics["representative_case_total"] == 2
    assert abs(metrics["representative_case_avg_per_intent"] - 1.0) < 1e-9
    assert metrics["intents_with_zero_cases"] == 1
