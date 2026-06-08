from __future__ import annotations

import json
from pathlib import Path

from pipeline.stages.draft_generation.main import (
    _build_workflow_draft,
    _cluster_workflow_events,
    _process_cluster_entry,
    _route_condition,
    _write_candidate,
)
from tests.helpers.draft_generation import (
    _preprocessed_conv,
    _runtime_config,
    _stage_context,
)


def test_build_workflow_draft_single_cluster() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "환불 문의",
            "workflow_signal": {},
            "workflow_confidence": 0.72,
            "workflow_confidence_components": {"label": 0.6},
            "sample_review_reason_codes": ["weak_label_sample"],
            "review_reason_codes": [],
            "review_tier": "sample_review",
        }
    ]
    draft, _ = _build_workflow_draft(clusters)

    assert len(draft["workflows"]) == 1
    assert len(draft["policies"]) == 1
    assert draft["workflows"][0]["workflowCode"] == "WORKFLOW_0"
    assert draft["workflows"][0]["intentCode"] == "INTENT_0"
    assert draft["workflows"][0]["isPrimary"] is True
    route = json.loads(draft["workflows"][0]["routeConditionJson"])
    assert route["requiredTerms"] == ["환불"]
    assert route["executionEligibility"] == "review_only"
    assert draft["slots"] == []
    assert draft["risks"] == []
    assert draft["intentSlotBindings"] == []
    meta = json.loads(draft["workflows"][0]["metaJson"])
    assert meta["sampleReviewReasonCodes"] == ["weak_label_sample"]
    assert meta["reviewReasonCodes"] == []
    assert meta["reviewOnlyCandidate"] is True


def test_process_cluster_entry_returns_named_workflow_result() -> None:
    result = _process_cluster_entry({"cluster_id": 0, "suggested_name": "환불 문의", "workflow_signal": {}})

    assert result is not None
    assert result.workflow["workflowCode"] == "WORKFLOW_0"
    assert result.keyword_count == 0
    assert result.exemplar_count == 0
    assert result.member_count == 0
    assert result.is_empty_evidence is True
    assert result.path_support == 0.0
    assert "has_specific_node" in result.graph_specific_metrics


def test_route_condition_uses_core_terms_without_dialogue_fillers() -> None:
    route = _route_condition(
        {
            "cluster_id": 3,
            "suggested_name": "카드 한도 문의",
            "keywords": ["한도", "알아서 주시", "계좌", "사용"],
            "label_candidates": [
                {"name": "카드 한도 문의", "score": 0.72, "evidenceCoverage": 0.6},
                {"name": "할부 가능여부확인 문의", "score": 0.49, "evidenceCoverage": 0.1},
            ],
            "member_conv_ids": ["c1"],
            "exemplar_conv_ids": ["c1"],
        },
        {
            "c1": _preprocessed_conv(
                "c1",
                problem="여보세요 알겠습니다 이게 잠시만 카드 한도 올려서 쓰고 싶어요.",
            )
        },
        path_case_count=3,
        workflow_path_support=0.9,
        review_only_reasons=[],
    )

    assert route["requiredTerms"] == ["카드", "한도"]
    route_terms = set(route["requiredTerms"]) | set(route["optionalTerms"])
    assert {"여보세", "알겠습니다", "이게", "잠시만", "주시", "알아서"}.isdisjoint(route_terms)


def test_route_condition_cleans_noisy_action_object_phrase() -> None:
    route = _route_condition(
        {
            "cluster_id": 4,
            "suggested_name": "명의 해지 문의",
            "action_object_frame": {"object": "명의로 지금 쓰고 있고", "action": "해지"},
            "member_conv_ids": ["c1"],
            "exemplar_conv_ids": ["c1"],
        },
        {"c1": _preprocessed_conv("c1", problem="제가 엄마 명의로 지금 쓰고 있고 해지되는지 문의합니다.")},
        path_case_count=3,
        workflow_path_support=0.8,
        review_only_reasons=[],
    )

    assert route["requiredTerms"] == ["명의", "해지"]
    route_terms = set(route["requiredTerms"]) | set(route["optionalTerms"])
    assert {"지금", "쓰고", "있고"}.isdisjoint(route_terms)


def test_build_workflow_draft_empty_clusters() -> None:
    draft, _ = _build_workflow_draft([])
    assert draft["workflows"] == []
    assert len(draft["policies"]) == 1


def test_build_workflow_draft_intent_workflow_1to1_mapping() -> None:
    clusters = [
        {"cluster_id": 0, "suggested_name": "A", "workflow_signal": {}},
        {"cluster_id": 1, "suggested_name": "B", "workflow_signal": {}},
    ]
    draft, _ = _build_workflow_draft(clusters)

    workflow_codes = {w["workflowCode"] for w in draft["workflows"]}
    intent_codes_in_workflows = {w["intentCode"] for w in draft["workflows"]}
    assert workflow_codes == {"WORKFLOW_0", "WORKFLOW_1"}
    assert intent_codes_in_workflows == {"INTENT_0", "INTENT_1"}


def test_build_workflow_draft_default_policy_is_dummy() -> None:
    draft, _ = _build_workflow_draft([{"cluster_id": 0, "suggested_name": "X", "workflow_signal": {}}])
    policy = draft["policies"][0]
    assert policy["policyCode"] == "default_policy"
    assert "Dummy" in policy["name"]


def test_cluster_workflow_events_uses_dominant_collapsed_sequence() -> None:
    cluster = {
        "cluster_id": 0,
        "member_conv_ids": ["c1", "c2", "c3"],
        "exemplar_conv_ids": ["c1"],
    }
    preprocessed_index = {
        "c1": {"flow_events": ["확인질문", "확인질문", "정책안내"]},
        "c2": {"flow_events": ["확인질문", "추가정보요청", "정책안내"]},
        "c3": {"flow_events": ["확인질문", "정책안내"]},
    }

    events = _cluster_workflow_events(cluster, preprocessed_index)

    assert events == ("확인질문", "정책안내")


def test_build_workflow_draft_uses_observed_flow_events_in_graph() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "처리 문의",
            "workflow_signal": {},
            "member_conv_ids": ["c1", "c2"],
            "exemplar_conv_ids": ["c1"],
        }
    ]
    preprocessed_index = {
        "c1": {"flow_events": ["확인질문", "정책안내"]},
        "c2": {"flow_events": ["확인질문", "정책안내"]},
    }

    draft, _metrics = _build_workflow_draft(clusters, preprocessed_index=preprocessed_index)
    graph = json.loads(draft["workflows"][0]["graphJson"])
    node_ids = [node["id"] for node in graph["nodes"]]

    assert "request_check" in node_ids
    assert "policy_check" in node_ids


def test_build_workflow_draft_metrics_counts_signals() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "workflow_signal": {
                "requires_user_identification": True,
                "requires_payment_check": False,
                "has_escalation_cases": False,
            },
        },
        {
            "cluster_id": 1,
            "workflow_signal": {
                "requires_user_identification": True,
                "requires_payment_check": True,
                "has_escalation_cases": True,
            },
        },
        {"cluster_id": 2, "workflow_signal": {}},
    ]
    _, m = _build_workflow_draft(clusters)
    assert m["workflow_count"] == 3
    assert m["workflow_with_identify_count"] == 2
    assert m["workflow_with_payment_check_count"] == 1
    assert m["workflow_with_escalation_count"] == 1


def test_write_candidate_creates_file(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _stage_context()
    candidate = {"schemaVersion": "1.0", "intentDraft": {"intents": []}}

    candidate_path = _write_candidate(context, runtime_config, candidate)

    assert candidate_path.exists()
    assert candidate_path.name == "candidate.json"
    written = json.loads(candidate_path.read_text(encoding="utf-8"))
    assert written["schemaVersion"] == "1.0"


# ---------------------------------------------------------------------------
# _build_workflow_draft — evidenceJson
# ---------------------------------------------------------------------------


def test_build_workflow_draft_evidence_json_is_not_empty_stub() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "환불 문의",
            "workflow_signal": {},
            "keywords": ["환불", "결제"],
            "exemplar_conv_ids": ["conv-1"],
            "member_conv_ids": ["conv-2"],
        }
    ]

    draft, _ = _build_workflow_draft(clusters)

    evidence_json = draft["workflows"][0]["evidenceJson"]
    assert evidence_json != "[]"
    parsed = json.loads(evidence_json)
    assert isinstance(parsed, list)


def test_build_workflow_draft_evidence_first_entry_is_first_keyword() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "환불",
            "workflow_signal": {},
            "keywords": ["환불", "결제"],
            "exemplar_conv_ids": [],
            "member_conv_ids": [],
        }
    ]

    draft, _ = _build_workflow_draft(clusters)

    parsed = json.loads(draft["workflows"][0]["evidenceJson"])
    assert parsed[0] == {"type": "keyword", "value": "환불"}


def test_build_workflow_draft_evidence_json_format_has_type_value() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "환불",
            "workflow_signal": {},
            "keywords": ["kw"],
            "exemplar_conv_ids": ["ex-id"],
            "member_conv_ids": ["mb-id"],
        }
    ]

    draft, _ = _build_workflow_draft(clusters)

    parsed = json.loads(draft["workflows"][0]["evidenceJson"])
    for item in parsed:
        assert "type" in item
        assert "value" in item
        assert item["type"] in {"keyword", "exemplar_conv_id", "member_conv_id"}


def test_build_workflow_draft_no_keywords_evidence_empty_stub_remains_empty_array() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "문의",
            "workflow_signal": {},
        }
    ]

    draft, _ = _build_workflow_draft(clusters)

    evidence_json = draft["workflows"][0]["evidenceJson"]
    assert json.loads(evidence_json) == []


def test_build_workflow_draft_metrics_include_evidence_4_keys() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "A",
            "workflow_signal": {},
            "keywords": ["kw1", "kw2"],
            "exemplar_conv_ids": ["ex-1"],
            "member_conv_ids": ["mb-1", "mb-2"],
        },
        {
            "cluster_id": 1,
            "suggested_name": "B",
            "workflow_signal": {},
        },
    ]

    _, metrics = _build_workflow_draft(clusters)

    assert "workflow_evidence_keyword_total" in metrics
    assert "workflow_evidence_exemplar_total" in metrics
    assert "workflow_evidence_member_total" in metrics
    assert "workflow_with_empty_evidence_count" in metrics


def test_build_workflow_draft_metrics_sum_matches_evidence() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "A",
            "workflow_signal": {},
            "keywords": ["kw1", "kw2"],
            "exemplar_conv_ids": ["ex-1"],
            "member_conv_ids": ["mb-1", "mb-2", "ex-1"],
        },
        {
            "cluster_id": 1,
            "suggested_name": "B",
            "workflow_signal": {},
        },
    ]

    _, metrics = _build_workflow_draft(clusters)

    assert metrics["workflow_evidence_keyword_total"] == 2
    assert metrics["workflow_evidence_exemplar_total"] == 1
    assert metrics["workflow_evidence_member_total"] == 2
    assert metrics["workflow_with_empty_evidence_count"] == 1
