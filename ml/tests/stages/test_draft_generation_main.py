from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.draft_generation.main import (
    _build_candidate,
    _build_intents,
    _build_slot_draft,
    _build_workflow_draft,
    _derive_pack_identity,
    _hydrate_case,
    _read_clusters,
    _read_preprocessed_index,
    _resolve_cases_per_intent,
    _write_candidate,
    run,
)
from pipeline.stages.publish_candidate.main import validate_candidate


def _runtime_config(tmp_path: Path) -> PipelineRuntimeConfig:
    return PipelineRuntimeConfig(artifact_root=tmp_path / "artifacts", backend_base_url="http://backend:8080")


def _stage_context(workspace_id: str | None = "ws1", dataset_id: str | None = None) -> StageContext:
    return StageContext(
        dag_id="dag",
        run_id="run1",
        stage_name="draft_generation",
        workspace_id=workspace_id,
        dataset_id=dataset_id,
    )


def _preprocessed_conv(conv_id: str, canonical: str = "text", problem: str = "problem") -> dict[str, Any]:
    return {
        "id": conv_id,
        "canonical_text": canonical,
        "customer_problem_text": problem,
        "ended_status": "resolved",
    }


def _write_clusters(clusters_dir: Path, clusters: list[dict[str, Any]]) -> None:
    clusters_dir.mkdir(parents=True, exist_ok=True)
    (clusters_dir / "clusters.json").write_text(
        json.dumps({"schema_version": "1.0", "clusters": clusters}), encoding="utf-8"
    )


def _write_preprocessed(preprocessed_dir: Path, conversations: list[dict[str, Any]]) -> None:
    preprocessed_dir.mkdir(parents=True, exist_ok=True)
    (preprocessed_dir / "preprocessed_data.json").write_text(
        json.dumps({"schema_version": "1.0", "conversations": conversations}), encoding="utf-8"
    )


def test_build_intents_full_hydration() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "환불 문의",
            "suggested_description": "환불 관련 클러스터",
            "exemplar_conv_ids": ["c1", "c2", "c3"],
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

    payload = _read_clusters(runtime_config, context)

    assert len(payload["clusters"]) == 1


def test_read_preprocessed_index_success(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _stage_context()
    preprocessed_dir = runtime_config.artifact_root / "dag" / "run1" / "preprocessing"
    _write_preprocessed(preprocessed_dir, [_preprocessed_conv("c1"), _preprocessed_conv("c2")])

    index = _read_preprocessed_index(runtime_config, context)

    assert set(index.keys()) == {"c1", "c2"}


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


def _write_upstream_manifest(tmp_path: Path) -> Path:
    manifest_path = tmp_path / "upstream_manifest.json"
    manifest_payload = {
        "dag_id": "dag",
        "run_id": "run1",
        "stage_name": "intent_discovery",
        "workspace_id": "ws1",
        "dataset_id": "ds1",
    }
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    return manifest_path


def test_run_success(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    clusters_dir = artifact_root / "dag" / "run1" / "intent_discovery"
    preprocessed_dir = artifact_root / "dag" / "run1" / "preprocessing"
    _write_clusters(
        clusters_dir,
        [
            {
                "cluster_id": 0,
                "suggested_name": "환불 문의",
                "suggested_description": "환불 관련",
                "exemplar_conv_ids": ["c1", "c2"],
                "workflow_signal": {},
            }
        ],
    )
    _write_preprocessed(preprocessed_dir, [_preprocessed_conv("c1"), _preprocessed_conv("c2")])
    manifest_path = _write_upstream_manifest(tmp_path)

    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

    result = run(upstream_manifest_path=str(manifest_path))

    candidate_path = artifact_root / "dag" / "run1" / "draft_generation" / "candidate.json"
    assert candidate_path.exists()
    assert result["candidateArtifactPath"] == str(candidate_path)
    candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
    assert candidate["schemaVersion"] == "1.0"
    assert len(candidate["intentDraft"]["intents"]) == 1
    assert candidate["intentDraft"]["intents"][0]["intentCode"] == "INTENT_0"
    assert candidate["domainPackDraft"]["packKey"] == "pack_wsws1_dsds1"
    assert len(candidate["workflowDraft"]["workflows"]) == 1
    assert candidate["workflowDraft"]["workflows"][0]["workflowCode"] == "WORKFLOW_0"


def test_run_keeps_single_dataset_candidate_when_segment_rows_exist(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    artifact_root = tmp_path / "artifacts"
    clusters_dir = artifact_root / "dag" / "run1" / "intent_discovery"
    preprocessed_dir = artifact_root / "dag" / "run1" / "preprocessing"
    _write_clusters(
        clusters_dir,
        [
            {
                "cluster_id": 0,
                "canonical_intent": "항공권 변경 문의",
                "suggested_name": "항공권 변경 문의",
                "suggested_description": "항공권 변경 관련",
                "exemplar_conv_ids": ["consultation-a", "consultation-b"],
                "workflow_signal": {"requires_user_identification": True},
            }
        ],
    )
    (clusters_dir / "intent_segments_v3.jsonl").write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "consultation_id": "consultation-a",
                        "canonical_intent": "항공권 변경 문의",
                        "cluster_id": 0,
                    },
                    ensure_ascii=False,
                ),
                json.dumps(
                    {
                        "consultation_id": "consultation-b",
                        "canonical_intent": "항공권 변경 문의",
                        "cluster_id": 0,
                    },
                    ensure_ascii=False,
                ),
            ]
        ),
        encoding="utf-8",
    )
    _write_preprocessed(
        preprocessed_dir,
        [
            _preprocessed_conv("consultation-a", "항공권 변경 요청", "항공권 변경"),
            _preprocessed_conv("consultation-b", "탑승자 변경 문의", "탑승자 변경"),
        ],
    )
    manifest_path = _write_upstream_manifest(tmp_path)

    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

    result = run(upstream_manifest_path=str(manifest_path))

    candidate = json.loads(Path(str(result["candidateArtifactPath"])).read_text(encoding="utf-8"))
    assert "candidateMode" not in candidate
    assert "candidates" not in candidate
    assert "consultationId" not in candidate
    assert candidate["domainPackDraft"]["packKey"] == "pack_wsws1_dsds1"
    assert len(candidate["intentDraft"]["intents"]) == 1
    assert len(candidate["intentDraft"]["intents"][0]["representativeCases"]) == 2


def test_build_candidate_structure() -> None:
    intents = [{"intentCode": "INTENT_0", "name": "환불", "representativeCases": []}]
    clusters = [{"cluster_id": 0, "suggested_name": "환불", "workflow_signal": {}}]
    context = _stage_context(workspace_id="ws1", dataset_id="ds1")
    workflow_draft, _ = _build_workflow_draft(clusters)

    candidate = _build_candidate(intents, workflow_draft, context)

    assert candidate["schemaVersion"] == "1.0"
    assert candidate["intentDraft"]["intents"] == intents
    assert candidate["domainPackDraft"]["packKey"] == "pack_wsws1_dsds1"
    assert candidate["domainPackDraft"]["packName"] == "Pack wsws1/dsds1"
    wf_draft = candidate["workflowDraft"]
    assert len(wf_draft["workflows"]) == 1
    assert wf_draft["workflows"][0]["workflowCode"] == "WORKFLOW_0"
    assert wf_draft["workflows"][0]["intentCode"] == "INTENT_0"
    assert len(wf_draft["policies"]) == 1
    assert wf_draft["policies"][0]["policyCode"] == "default_policy"


def test_build_candidate_raises_when_workspace_id_missing() -> None:
    context = _stage_context(workspace_id=None, dataset_id="ds1")
    with pytest.raises(PipelineStageError, match="packKey requires both"):
        _build_candidate([], {}, context)


def test_build_candidate_raises_when_dataset_id_missing() -> None:
    context = _stage_context(workspace_id="ws1", dataset_id=None)
    with pytest.raises(PipelineStageError, match="packKey requires both"):
        _build_candidate([], {}, context)


def test_derive_pack_identity_formats_correctly() -> None:
    context = _stage_context(workspace_id="ws42", dataset_id="ds7")
    pack_key, pack_name = _derive_pack_identity(context)
    assert pack_key == "pack_wsws42_dsds7"
    assert pack_name == "Pack wsws42/dsds7"


def test_derive_pack_identity_raises_on_none_workspace() -> None:
    context = _stage_context(workspace_id=None, dataset_id="ds1")
    with pytest.raises(PipelineStageError, match="packKey requires both workspace_id and dataset_id"):
        _derive_pack_identity(context)


def test_derive_pack_identity_raises_on_none_dataset() -> None:
    context = _stage_context(workspace_id="ws1", dataset_id=None)
    with pytest.raises(PipelineStageError, match="packKey requires both workspace_id and dataset_id"):
        _derive_pack_identity(context)


def test_build_workflow_draft_single_cluster() -> None:
    clusters = [{"cluster_id": 0, "suggested_name": "환불 문의", "workflow_signal": {}}]
    draft, _ = _build_workflow_draft(clusters)

    assert len(draft["workflows"]) == 1
    assert len(draft["policies"]) == 1
    assert draft["workflows"][0]["workflowCode"] == "WORKFLOW_0"
    assert draft["workflows"][0]["intentCode"] == "INTENT_0"
    assert draft["workflows"][0]["isPrimary"] is True
    assert draft["workflows"][0]["routeConditionJson"] == "{}"
    assert draft["slots"] == []
    assert draft["risks"] == []
    assert draft["intentSlotBindings"] == []


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


# ---------------------------------------------------------------------------
# _build_slot_draft
# ---------------------------------------------------------------------------


def test_build_slot_draft_all_signals_false_returns_empty() -> None:
    clusters = [
        {
            "cluster_id": 1,
            "workflow_signal": {
                "requires_payment_check": False,
                "requires_user_identification": False,
                "has_escalation_cases": False,
            },
        }
    ]

    slots, bindings, metrics = _build_slot_draft(clusters)

    assert slots == []
    assert bindings == []
    assert metrics["slot_count"] == 0
    assert metrics["cluster_with_slot_count"] == 0


def test_build_slot_draft_payment_check_true_yields_two_slots() -> None:
    clusters = [
        {
            "cluster_id": 1,
            "workflow_signal": {
                "requires_payment_check": True,
                "requires_user_identification": False,
                "has_escalation_cases": False,
            },
        }
    ]

    slots, bindings, _ = _build_slot_draft(clusters)

    assert len(slots) == 2
    assert len(bindings) == 2
    slot_codes = [s["slotCode"] for s in slots]
    assert "SLOT_1_1" in slot_codes
    assert "SLOT_1_2" in slot_codes
    names = {s["name"] for s in slots}
    assert "주문 ID" in names
    assert "결제 수단" in names


def test_build_slot_draft_user_identification_is_sensitive() -> None:
    clusters = [
        {
            "cluster_id": 2,
            "workflow_signal": {
                "requires_payment_check": False,
                "requires_user_identification": True,
                "has_escalation_cases": False,
            },
        }
    ]

    slots, bindings, _ = _build_slot_draft(clusters)

    assert len(slots) == 2
    assert all(s["isSensitive"] is True for s in slots)
    names = {s["name"] for s in slots}
    assert "고객 이름" in names
    assert "고객 연락처" in names


def test_build_slot_draft_all_signals_true_yields_five_slots() -> None:
    clusters = [
        {
            "cluster_id": 3,
            "workflow_signal": {
                "requires_payment_check": True,
                "requires_user_identification": True,
                "has_escalation_cases": True,
            },
        }
    ]

    slots, bindings, _ = _build_slot_draft(clusters)

    assert len(slots) == 5
    assert len(bindings) == 5
    collection_orders = sorted(b["collectionOrder"] for b in bindings)
    assert collection_orders == [1, 2, 3, 4, 5]


def test_build_slot_draft_multiple_clusters_slot_codes_reset() -> None:
    clusters = [
        {"cluster_id": 1, "workflow_signal": {"requires_payment_check": True}},
        {"cluster_id": 2, "workflow_signal": {"requires_payment_check": True}},
    ]

    slots, _, _ = _build_slot_draft(clusters)

    slot_codes = [s["slotCode"] for s in slots]
    assert "SLOT_1_1" in slot_codes
    assert "SLOT_1_2" in slot_codes
    assert "SLOT_2_1" in slot_codes
    assert "SLOT_2_2" in slot_codes


def test_build_slot_draft_intent_code_matches_cluster_id() -> None:
    clusters = [
        {"cluster_id": 7, "workflow_signal": {"requires_payment_check": True}},
    ]

    _, bindings, _ = _build_slot_draft(clusters)

    assert all(b["intentCode"] == "INTENT_7" for b in bindings)


def test_build_slot_draft_metrics_accuracy() -> None:
    clusters = [
        {
            "cluster_id": 0,
            "workflow_signal": {
                "requires_payment_check": True,
                "requires_user_identification": True,
                "has_escalation_cases": False,
            },
        },
        {
            "cluster_id": 1,
            "workflow_signal": {
                "requires_payment_check": False,
                "requires_user_identification": False,
                "has_escalation_cases": True,
            },
        },
        {
            "cluster_id": 2,
            "workflow_signal": {},
        },
    ]

    _, _, metrics = _build_slot_draft(clusters)

    assert metrics["slot_count"] == 5  # 2+2 + 1
    assert metrics["cluster_with_slot_count"] == 2
    assert metrics["signal_slot_hit_payment_check"] == 1
    assert metrics["signal_slot_hit_user_identification"] == 1
    assert metrics["signal_slot_hit_escalation"] == 1


def test_run_success_with_signals_slots_populated(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    clusters_dir = artifact_root / "dag" / "run1" / "intent_discovery"
    preprocessed_dir = artifact_root / "dag" / "run1" / "preprocessing"
    _write_clusters(
        clusters_dir,
        [
            {
                "cluster_id": 0,
                "suggested_name": "결제 문의",
                "suggested_description": "결제 관련",
                "exemplar_conv_ids": [],
                "workflow_signal": {
                    "requires_payment_check": True,
                    "requires_user_identification": False,
                    "has_escalation_cases": False,
                },
            }
        ],
    )
    _write_preprocessed(preprocessed_dir, [])
    manifest_path = _write_upstream_manifest(tmp_path)

    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

    run(upstream_manifest_path=str(manifest_path))

    candidate_path = artifact_root / "dag" / "run1" / "draft_generation" / "candidate.json"
    candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
    slots = candidate["workflowDraft"]["slots"]
    bindings = candidate["workflowDraft"]["intentSlotBindings"]
    assert len(slots) == 2
    assert len(bindings) == 2
    assert slots[0]["slotCode"] == "SLOT_0_1"
    assert bindings[0]["intentCode"] == "INTENT_0"


def test_publish_candidate_validate_accepts_slot_draft() -> None:
    clusters = [
        {
            "cluster_id": 1,
            "suggested_name": "결제 문의",
            "suggested_description": "결제 관련",
            "exemplar_conv_ids": [],
            "workflow_signal": {
                "requires_payment_check": True,
                "requires_user_identification": False,
                "has_escalation_cases": False,
            },
        }
    ]
    context = _stage_context(workspace_id="ws1", dataset_id="ds1")

    intents, _ = _build_intents(clusters, {}, cases_per_intent=0)
    workflow_draft, _ = _build_workflow_draft(clusters)
    slots, intent_slot_bindings, _ = _build_slot_draft(clusters)
    workflow_draft["slots"] = slots
    workflow_draft["intentSlotBindings"] = intent_slot_bindings
    candidate = _build_candidate(intents, workflow_draft, context)

    validate_candidate(candidate)  # must not raise
