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
    _cluster_workflow_events,
    _derive_pack_identity,
    _evaluation_inputs,
    _hydrate_case,
    _label_metrics,
    _read_clusters,
    _read_preprocessed_index,
    _resolve_cases_per_intent,
    _route_condition,
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
        json.dumps(
            {
                "schema_version": "1.0",
                "clusters": clusters,
                "stats": {"outlier_rate": 0.12},
                "flow_split_metrics": {
                    "workflowSeparability": 0.9,
                    "entrypointDistinctiveness": 0.72,
                    "entrypointSemanticCoverage": 1.0,
                },
            }
        ),
        encoding="utf-8",
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
    assert candidate["evaluationInputs"]["outlierRate"] == 0.12
    assert candidate["evaluationInputs"]["workflowSeparability"] == 0.9
    assert candidate["evaluationInputs"]["entrypointDistinctiveness"] == 0.72
    assert candidate["evaluationInputs"]["mappingRate"] == 1.0
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


def test_evaluation_inputs_collects_source_quality_metrics() -> None:
    evaluation_inputs = _evaluation_inputs(
        {
            "stats": {"outlier_rate": 0.2},
            "flow_split_metrics": {"workflowSeparability": 0.75},
        },
        {"intent_count": 2},
        {"workflow_count": 2},
        {"cluster_with_slot_count": 1},
    )

    assert evaluation_inputs == {
        "mappingRate": 1.0,
        "outlierRate": 0.2,
        "workflowSeparability": 0.75,
        "slotCoverage": 0.5,
    }


def test_evaluation_inputs_prefers_unrepresented_outlier_rate() -> None:
    evaluation_inputs = _evaluation_inputs(
        {
            "stats": {"outlier_rate": 0.6},
            "flow_split_metrics": {
                "workflowSeparability": 1.0,
                "unrepresentedOutlierRate": 0.0,
                "representedOutlierCoverage": 1.0,
                "promotedNovelCandidateCount": 1,
                "promotedNovelMemberCount": 3,
                "unrepresentedOutlierMemberCount": 0,
            },
        },
        {"intent_count": 1},
        {"workflow_count": 1},
        {"cluster_with_slot_count": 1},
    )

    assert evaluation_inputs["outlierRate"] == 0.0
    assert evaluation_inputs["rawOutlierRate"] == 0.6
    assert evaluation_inputs["representedOutlierCoverage"] == 1.0
    assert evaluation_inputs["promotedNovelCandidateCount"] == 1


def test_evaluation_inputs_maps_workflows_against_leaf_intents() -> None:
    evaluation_inputs = _evaluation_inputs(
        {
            "stats": {"outlier_rate": 0.0},
            "flow_split_metrics": {"workflowSeparability": 0.9},
        },
        {
            "intent_count": 3,
            "parent_intent_count": 1,
            "leaf_intent_count": 2,
            "workflow_variant_intent_count": 2,
            "variants_per_parent_intent_avg": 2.0,
            "variants_per_parent_intent_max": 2,
            "single_variant_intent_rate": 0.0,
        },
        {"workflow_count": 2},
        {"cluster_with_slot_count": 1},
    )

    assert evaluation_inputs["mappingRate"] == 1.0
    assert evaluation_inputs["slotCoverage"] == 0.5
    assert evaluation_inputs["parentIntentCount"] == 1.0
    assert evaluation_inputs["leafIntentCount"] == 2.0
    assert evaluation_inputs["workflowVariantIntentCount"] == 2.0
    assert evaluation_inputs["variantsPerParentIntentAvg"] == 2.0
    assert evaluation_inputs["variantsPerParentIntentMax"] == 2.0
    assert evaluation_inputs["singleVariantIntentRate"] == 0.0


def test_evaluation_inputs_collects_label_and_workflow_path_metrics() -> None:
    evaluation_inputs = _evaluation_inputs(
        {
            "stats": {"outlier_rate": 0.0},
            "flow_split_metrics": {"workflowSeparability": 1.0},
            "clusters": [
                {
                    "label_score": 0.8,
                    "label_evidence_coverage": 0.75,
                    "label_member_evidence_coverage": 0.5,
                    "label_object_action_joint_coverage": 0.7,
                    "label_validation_status": "auto_acceptable",
                },
                {
                    "label_score": 0.6,
                    "label_evidence_coverage": 0.5,
                    "label_member_evidence_coverage": 0.25,
                    "label_object_action_joint_coverage": 0.2,
                    "label_validation_status": "needs_review",
                },
            ],
        },
        {"intent_count": 2},
        {"workflow_count": 2, "workflow_path_support": 0.7, "workflow_replay_fitness": 0.65},
        {"cluster_with_slot_count": 2},
    )

    assert evaluation_inputs["labelFidelity"] == pytest.approx(0.7)
    assert evaluation_inputs["labelEvidenceCoverage"] == pytest.approx(0.625)
    assert evaluation_inputs["labelMemberEvidenceCoverage"] == pytest.approx(0.375)
    assert evaluation_inputs["labelObjectActionJointCoverage"] == pytest.approx(0.45)
    assert evaluation_inputs["labelNeedsReviewRate"] == pytest.approx(0.5)
    assert evaluation_inputs["autoCandidateLabelCount"] == 1.0
    assert evaluation_inputs["autoCandidateLabelMemberEvidenceCoverage"] == 0.5
    assert evaluation_inputs["autoCandidateLabelObjectActionJointCoverage"] == 0.7
    assert evaluation_inputs["reviewRequiredLabelCount"] == 1.0
    assert evaluation_inputs["reviewRequiredLabelMemberEvidenceCoverage"] == 0.25
    assert evaluation_inputs["workflowPathSupport"] == 0.7
    assert evaluation_inputs["workflowReplayFitness"] == 0.65


def test_label_metrics_separate_review_only_novel_candidates() -> None:
    metrics = _label_metrics(
        [
            {
                "label_score": 0.8,
                "label_evidence_coverage": 0.75,
                "label_member_evidence_coverage": 0.5,
                "label_object_action_joint_coverage": 0.6,
                "label_validation_status": "auto_acceptable",
            },
            {
                "label_score": 0.2,
                "label_evidence_coverage": 0.0,
                "label_member_evidence_coverage": 0.0,
                "label_object_action_joint_coverage": 0.0,
                "label_validation_status": "needs_review",
                "is_novel_outlier_candidate": True,
            },
        ]
    )

    assert metrics["labelFidelity"] == 0.8
    assert metrics["labelMemberEvidenceCoverage"] == 0.5
    assert metrics["labelObjectActionJointCoverage"] == 0.6
    assert metrics["labelNeedsReviewRate"] == 0.0
    assert metrics["autoCandidateLabelCount"] == 1.0
    assert metrics["autoCandidateLabelObjectActionJointCoverage"] == 0.6
    assert metrics["reviewCandidateLabelFidelity"] == 0.2


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
    assert "업무 식별 정보" in names
    assert "결제/납부 수단" in names


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

    assert len(slots) == 1
    assert all(s["isSensitive"] is True for s in slots)
    names = {s["name"] for s in slots}
    assert "본인 확인 정보" in names


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

    assert len(slots) == 4
    assert len(bindings) == 4
    collection_orders = sorted(b["collectionOrder"] for b in bindings)
    assert collection_orders == [1, 2, 3, 4]


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

    assert metrics["slot_count"] == 4  # 2 + 1 + 1
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
