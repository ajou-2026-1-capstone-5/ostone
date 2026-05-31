from __future__ import annotations

import json
from pathlib import Path
from typing import cast

import numpy as np
import pytest

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.flow_splitting import main as flow_splitting
from pipeline.stages.flow_splitting.main import run


def test_flow_splitting_creates_entrypoints_and_split_clusters(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_FLOW_SPLIT_STRATEGY", "signal")
    monkeypatch.setenv("PIPELINE_FLOW_MIN_SPLIT_SIZE", "3")
    base_dir = artifact_root / "domain_pack_generation" / "manual__run"
    intent_dir = base_dir / "intent_discovery"
    preprocessing_dir = base_dir / "preprocessing"
    intent_dir.mkdir(parents=True)
    preprocessing_dir.mkdir(parents=True)

    (intent_dir / "clusters.json").write_text(
        json.dumps(
            {
                "schema_version": "1.0",
                "clusters": [
                    {
                        "cluster_id": 7,
                        "member_indices": [0, 1, 2, 3, 4, 5],
                        "member_conv_ids": ["c1", "c2", "c3", "c4", "c5", "c6"],
                        "exemplar_conv_ids": ["c1", "c4"],
                        "suggested_name": "배송 문의",
                        "workflow_signal": {"has_escalation_cases": True},
                        "quality": {
                            "interpretability_score": 0.8,
                            "workflow_consistency_score": 0.7,
                            "branching_explainability_score": 0.6,
                        },
                    }
                ],
                "stats": {},
            }
        ),
        encoding="utf-8",
    )
    np.save(
        intent_dir / "embeddings.npy",
        np.asarray(
            [
                [1.00, 0.00],
                [0.98, 0.02],
                [0.96, 0.04],
                [0.00, 1.00],
                [0.02, 0.98],
                [0.04, 0.96],
            ],
            dtype=np.float32,
        ),
    )
    (preprocessing_dir / "preprocessed_data.json").write_text(
        json.dumps(
            {
                "conversations": [
                    {"id": "c1", "ended_status": "resolved", "workflow_signal": {"requires_payment_check": True}},
                    {"id": "c2", "ended_status": "resolved", "workflow_signal": {"requires_payment_check": True}},
                    {"id": "c3", "ended_status": "resolved", "workflow_signal": {"requires_payment_check": True}},
                    {"id": "c4", "ended_status": "escalated", "workflow_signal": {"has_escalation_cases": True}},
                    {"id": "c5", "ended_status": "escalated", "workflow_signal": {"has_escalation_cases": True}},
                    {"id": "c6", "ended_status": "escalated", "workflow_signal": {"has_escalation_cases": True}},
                ]
            }
        ),
        encoding="utf-8",
    )
    upstream_manifest = intent_dir / "manifest.json"
    upstream_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__run",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "11",
                "payload": {"artifact_path": "clusters.json"},
            }
        ),
        encoding="utf-8",
    )

    result = run(str(upstream_manifest))

    manifest_path = Path(cast(str, result["artifact_manifest_path"]))
    output_dir = manifest_path.parent
    clusters = json.loads((output_dir / "clusters.json").read_text(encoding="utf-8"))
    entrypoints = json.loads((output_dir / "workflow_entrypoints.json").read_text(encoding="utf-8"))
    report = json.loads((output_dir / "flow_split_report.json").read_text(encoding="utf-8"))

    assert len(clusters["clusters"]) == 2
    assert len(entrypoints["workflowEntryPoints"]) == 2
    assert report["splitCount"] == 1
    assert report["splitStrategy"] == "signal"
    assert report["workflowSeparability"] == 1.0
    assert clusters["flow_split_metrics"]["workflowSeparability"] == 1.0
    assert clusters["clusters"][0]["source_cluster_id"] == 7
    assert clusters["clusters"][0]["member_indices"] == [0, 1, 2]
    assert clusters["clusters"][1]["member_indices"] == [3, 4, 5]
    assert report["entrypointSemanticCoverage"] == 1.0
    assert report["entrypointDistinctiveness"] > 0.9
    assert (
        clusters["clusters"][0]["entrypoint_semantic_quality"]["nearestCompetitorWorkflowEntryPointId"]
        == "entrypoint-1"
    )
    assert (
        clusters["clusters"][1]["entrypoint_semantic_quality"]["nearestCompetitorWorkflowEntryPointId"]
        == "entrypoint-0"
    )
    assert (
        entrypoints["workflowEntryPoints"][0]["semanticQuality"]["nearestCompetitorWorkflowEntryPointId"]
        == "entrypoint-1"
    )
    assert clusters["clusters"][0]["workflow_signal"]["requires_payment_check"] is True
    assert clusters["clusters"][1]["workflow_signal"]["has_escalation_cases"] is True


def test_flow_splitting_rejects_missing_clusters_list(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    base_dir = artifact_root / "domain_pack_generation" / "manual__run"
    intent_dir = base_dir / "intent_discovery"
    preprocessing_dir = base_dir / "preprocessing"
    intent_dir.mkdir(parents=True)
    preprocessing_dir.mkdir(parents=True)
    (intent_dir / "clusters.json").write_text(json.dumps({"clusters": {}}), encoding="utf-8")
    (preprocessing_dir / "preprocessed_data.json").write_text(json.dumps({"conversations": []}), encoding="utf-8")
    upstream_manifest = intent_dir / "manifest.json"
    upstream_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__run",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "11",
                "payload": {"artifact_path": "clusters.json"},
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(PipelineStageError, match="clusters list"):
        run(str(upstream_manifest))


def test_flow_splitting_copies_single_flow_cluster(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_FLOW_SPLIT_STRATEGY", "conservative")
    base_dir = artifact_root / "domain_pack_generation" / "manual__run"
    intent_dir = base_dir / "intent_discovery"
    preprocessing_dir = base_dir / "preprocessing"
    intent_dir.mkdir(parents=True)
    preprocessing_dir.mkdir(parents=True)
    (intent_dir / "clusters.json").write_text(
        json.dumps(
            {
                "clusters": [
                    "ignored",
                    {
                        "cluster_id": 3,
                        "member_conv_ids": ["c1", "c2"],
                        "exemplar_conv_ids": ["c1"],
                        "suggested_name": "주소 변경",
                    },
                ]
            }
        ),
        encoding="utf-8",
    )
    (preprocessing_dir / "preprocessed_data.json").write_text(
        json.dumps({"conversations": [{"id": "c1", "ended_status": "resolved"}, {"id": "c2"}]}),
        encoding="utf-8",
    )
    upstream_manifest = intent_dir / "manifest.json"
    upstream_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__run",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "11",
                "payload": {"artifact_path": "clusters.json"},
            }
        ),
        encoding="utf-8",
    )

    result = run(str(upstream_manifest))

    output_dir = Path(cast(str, result["artifact_manifest_path"])).parent
    entrypoints = json.loads((output_dir / "workflow_entrypoints.json").read_text(encoding="utf-8"))
    assert entrypoints["workflowEntryPoints"][0]["splitReason"] == "single_flow"


def test_flow_splitting_demotes_single_member_auto_label(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_FLOW_SPLIT_STRATEGY", "conservative")
    base_dir = artifact_root / "domain_pack_generation" / "manual__run"
    intent_dir = base_dir / "intent_discovery"
    preprocessing_dir = base_dir / "preprocessing"
    intent_dir.mkdir(parents=True)
    preprocessing_dir.mkdir(parents=True)
    (intent_dir / "clusters.json").write_text(
        json.dumps(
            {
                "clusters": [
                    {
                        "cluster_id": 3,
                        "member_conv_ids": ["c1"],
                        "exemplar_conv_ids": ["c1"],
                        "suggested_name": "카드 신청 문의",
                        "label_validation_status": "auto_acceptable",
                    },
                ]
            }
        ),
        encoding="utf-8",
    )
    (preprocessing_dir / "preprocessed_data.json").write_text(
        json.dumps({"conversations": [{"id": "c1", "ended_status": "resolved"}]}),
        encoding="utf-8",
    )
    upstream_manifest = intent_dir / "manifest.json"
    upstream_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__run",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "11",
                "payload": {"artifact_path": "clusters.json"},
            }
        ),
        encoding="utf-8",
    )

    result = run(str(upstream_manifest))

    output_dir = Path(cast(str, result["artifact_manifest_path"])).parent
    clusters = json.loads((output_dir / "clusters.json").read_text(encoding="utf-8"))
    assert clusters["clusters"][0]["label_validation_status"] == "needs_review"


def test_flow_splitting_promotes_novel_candidates_as_review_only_workflows(
    monkeypatch,
    tmp_path: Path,
) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    base_dir = artifact_root / "domain_pack_generation" / "manual__run"
    intent_dir = base_dir / "intent_discovery"
    preprocessing_dir = base_dir / "preprocessing"
    intent_dir.mkdir(parents=True)
    preprocessing_dir.mkdir(parents=True)
    (intent_dir / "clusters.json").write_text(
        json.dumps(
            {
                "clusters": [],
                "novel_candidates": [
                    {
                        "candidate_key": "outlier_frame:요금:확인:3",
                        "source_type": "outlier_frame",
                        "candidate_size": 3,
                        "suggested_name": "요금 확인 문의",
                        "member_conv_ids": ["c1", "c2", "c3"],
                    }
                ],
                "stats": {"input_count": 5, "outlier_count": 3, "outlier_rate": 0.6},
            }
        ),
        encoding="utf-8",
    )
    (preprocessing_dir / "preprocessed_data.json").write_text(
        json.dumps(
            {
                "conversations": [
                    {
                        "id": "c1",
                        "canonical_text": "요금 확인 문의",
                        "customer_problem_text": "요금 확인 문의",
                        "workflow_signal": {},
                        "action_object_frame": {"object": "요금", "action": "확인", "confidence": 0.9},
                    },
                    {
                        "id": "c2",
                        "canonical_text": "요금 내역 확인",
                        "customer_problem_text": "요금 내역 확인",
                        "workflow_signal": {},
                        "action_object_frame": {"object": "요금", "action": "확인", "confidence": 0.8},
                    },
                    {
                        "id": "c3",
                        "canonical_text": "요금 다시 확인",
                        "customer_problem_text": "요금 다시 확인",
                        "workflow_signal": {},
                        "action_object_frame": {"object": "요금", "action": "확인", "confidence": 0.7},
                    },
                ]
            }
        ),
        encoding="utf-8",
    )
    upstream_manifest = intent_dir / "manifest.json"
    upstream_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__run",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "11",
                "payload": {"artifact_path": "clusters.json"},
            }
        ),
        encoding="utf-8",
    )

    result = run(str(upstream_manifest))

    output_dir = Path(cast(str, result["artifact_manifest_path"])).parent
    clusters = json.loads((output_dir / "clusters.json").read_text(encoding="utf-8"))
    report = json.loads((output_dir / "flow_split_report.json").read_text(encoding="utf-8"))
    promoted = clusters["clusters"][0]

    assert len(clusters["clusters"]) == 1
    assert promoted["is_novel_outlier_candidate"] is True
    assert promoted["label_validation_status"] == "needs_review"
    assert promoted["review_tier"] == "human_review"
    assert "novel_outlier_candidate" in promoted["review_reason_codes"]
    assert report["promotedNovelCandidateCount"] == 1
    assert report["representedOutlierCoverage"] == 1.0
    assert report["unrepresentedOutlierRate"] == 0.0


def test_confidence_review_reasons_allow_clean_mid_confidence_sample_review() -> None:
    reasons = flow_splitting._review_reason_codes(
        confidence=0.72,
        components={
            "semantic": 0.72,
            "flow": 0.72,
            "evidence": 0.72,
            "label": 0.72,
            "support": 0.72,
            "safety": 1.0,
        },
        split_reason="no_signal",
        coverage_share=0.08,
        duplicate_label_count=1,
        low_quality_ratio=0.0,
    )

    assert reasons == []
    assert flow_splitting._review_tier(0.72, needs_review=False) == "sample_review"


def test_confidence_review_reasons_still_block_weak_evidence_above_threshold() -> None:
    reasons = flow_splitting._review_reason_codes(
        confidence=0.72,
        components={
            "semantic": 0.72,
            "flow": 0.72,
            "evidence": 0.45,
            "label": 0.72,
            "support": 0.72,
            "safety": 1.0,
        },
        split_reason="no_signal",
        coverage_share=0.08,
        duplicate_label_count=1,
        low_quality_ratio=0.0,
    )

    assert reasons == ["weak_evidence_support"]
    assert flow_splitting._review_tier(0.72, needs_review=True) == "human_review"


def test_confidence_review_reasons_route_label_only_weakness_to_sample_review() -> None:
    components = {
        "semantic": 0.72,
        "flow": 0.72,
        "evidence": 0.72,
        "label": 0.50,
        "support": 0.72,
        "safety": 1.0,
    }

    reasons = flow_splitting._review_reason_codes(
        confidence=0.72,
        components=components,
        split_reason="no_signal",
        coverage_share=0.08,
        duplicate_label_count=1,
        low_quality_ratio=0.0,
    )
    sample_reasons = flow_splitting._sample_review_reason_codes(
        components=components,
        duplicate_label_count=1,
    )

    assert reasons == []
    assert sample_reasons == ["weak_label_sample"]
    assert flow_splitting._review_tier(0.72, needs_review=False) == "sample_review"


def test_confidence_review_reasons_block_very_weak_label() -> None:
    reasons = flow_splitting._review_reason_codes(
        confidence=0.72,
        components={
            "semantic": 0.72,
            "flow": 0.72,
            "evidence": 0.72,
            "label": 0.35,
            "support": 0.72,
            "safety": 1.0,
        },
        split_reason="no_signal",
        coverage_share=0.08,
        duplicate_label_count=1,
        low_quality_ratio=0.0,
    )

    assert reasons == ["weak_or_duplicate_label"]


def test_confidence_uses_expanded_support_floor_for_compound_action_splits() -> None:
    member_ids = ["c1", "c2", "c3"]
    payload = flow_splitting._workflow_confidence_payload(
        {
            "member_conv_ids": member_ids,
            "exemplar_conv_ids": ["c1", "c2", "c3"],
            "keywords": ["결제", "금액"],
            "quality": {
                "interpretability_score": 0.8,
                "workflow_consistency_score": 0.8,
                "branching_explainability_score": 0.8,
            },
            "suggested_name": "결제 금액 문의",
            "label_score": 0.8,
            "label_evidence_coverage": 1.0,
            "label_action_object_validity": 0.8,
        },
        split_reason="resolved:no_signal|action:결제",
        preprocessed_index={
            conv_id: {"flow_events": ["확인질문", "해결"], "workflow_signal": {}} for conv_id in member_ids
        },
        total_member_count=30,
        min_split_size=5,
        duplicate_label_count=1,
    )

    assert payload["support_min_split_size"] == 4
    assert payload["workflow_confidence_components"]["support"] == pytest.approx(
        flow_splitting._support_confidence(member_ids, 4)
    )
    assert payload["workflow_confidence_components"]["evidence"] > flow_splitting._evidence_confidence(
        {"exemplar_conv_ids": ["c1", "c2", "c3"], "keywords": ["결제", "금액"]},
        member_ids,
        5,
    )


def test_semantic_confidence_uses_entrypoint_boundary_quality() -> None:
    weak_boundary = flow_splitting._semantic_confidence(
        {
            "quality": {
                "interpretability_score": 0.85,
                "workflow_consistency_score": 0.85,
                "branching_explainability_score": 0.85,
                "entrypoint_semantic_cohesion": 0.90,
                "entrypoint_semantic_distinctiveness": 0.05,
                "entrypoint_semantic_separation_margin": -0.02,
            }
        }
    )
    strong_boundary = flow_splitting._semantic_confidence(
        {
            "quality": {
                "interpretability_score": 0.85,
                "workflow_consistency_score": 0.85,
                "branching_explainability_score": 0.85,
                "entrypoint_semantic_cohesion": 0.90,
                "entrypoint_semantic_distinctiveness": 0.70,
                "entrypoint_semantic_separation_margin": 0.04,
            }
        }
    )

    assert weak_boundary < 0.85
    assert strong_boundary > weak_boundary


def test_weak_entrypoint_semantic_boundary_requires_review_reason() -> None:
    assert (
        flow_splitting._has_weak_entrypoint_semantic_boundary(
            {
                "entrypoint_semantic_quality": {
                    "distinctiveness": 0.12,
                    "separationMargin": -0.01,
                }
            }
        )
        is True
    )
    assert (
        flow_splitting._has_weak_entrypoint_semantic_boundary(
            {
                "entrypoint_semantic_quality": {
                    "distinctiveness": 0.28,
                    "separationMargin": 0.01,
                }
            }
        )
        is False
    )


def test_confidence_routes_clean_weak_semantic_boundary_to_sample_review() -> None:
    member_ids = ["c1", "c2", "c3", "c4", "c5"]
    payload = flow_splitting._workflow_confidence_payload(
        {
            "member_conv_ids": member_ids,
            "exemplar_conv_ids": member_ids[:3],
            "keywords": ["결제", "금액", "카드", "납부", "확인"],
            "quality": {
                "interpretability_score": 0.9,
                "workflow_consistency_score": 0.9,
                "branching_explainability_score": 0.9,
            },
            "entrypoint_semantic_quality": {
                "distinctiveness": 0.12,
                "separationMargin": -0.01,
            },
            "suggested_name": "결제 금액 문의",
            "label_score": 0.82,
            "label_evidence_coverage": 1.0,
            "label_action_object_validity": 0.8,
        },
        split_reason="no_signal",
        preprocessed_index={
            conv_id: {"flow_events": ["확인질문", "정책안내", "해결"], "workflow_signal": {}} for conv_id in member_ids
        },
        total_member_count=30,
        min_split_size=5,
        duplicate_label_count=1,
    )

    assert payload["workflow_confidence"] >= 0.70
    assert payload["needs_human_review"] is False
    assert "weak_semantic_boundary" not in payload["review_reason_codes"]
    assert payload["sample_review_reason_codes"] == ["weak_semantic_boundary_sample"]
    assert payload["review_tier"] == "sample_review"


def test_confidence_blocks_weak_semantic_boundary_when_other_hard_reason_exists() -> None:
    member_ids = ["c1", "c2", "c3", "c4", "c5"]
    payload = flow_splitting._workflow_confidence_payload(
        {
            "member_conv_ids": member_ids,
            "exemplar_conv_ids": member_ids[:3],
            "keywords": ["결제", "금액", "카드", "납부", "확인"],
            "quality": {
                "interpretability_score": 0.9,
                "workflow_consistency_score": 0.9,
                "branching_explainability_score": 0.9,
            },
            "entrypoint_semantic_quality": {
                "distinctiveness": 0.12,
                "separationMargin": -0.01,
            },
            "suggested_name": "결제 금액 문의",
            "label_score": 0.35,
            "label_evidence_coverage": 0.20,
            "label_action_object_validity": 0.8,
        },
        split_reason="no_signal",
        preprocessed_index={
            conv_id: {"flow_events": ["확인질문", "정책안내", "해결"], "workflow_signal": {}} for conv_id in member_ids
        },
        total_member_count=30,
        min_split_size=5,
        duplicate_label_count=1,
    )

    assert payload["needs_human_review"] is True
    assert "weak_or_duplicate_label" in payload["review_reason_codes"]
    assert "weak_semantic_boundary" in payload["review_reason_codes"]


def test_flow_splitting_conservative_strategy_keeps_signal_variants_in_one_entrypoint(
    monkeypatch,
    tmp_path: Path,
) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_FLOW_SPLIT_STRATEGY", "conservative")
    base_dir = artifact_root / "domain_pack_generation" / "manual__run"
    intent_dir = base_dir / "intent_discovery"
    preprocessing_dir = base_dir / "preprocessing"
    intent_dir.mkdir(parents=True)
    preprocessing_dir.mkdir(parents=True)
    (intent_dir / "clusters.json").write_text(
        json.dumps(
            {
                "clusters": [
                    {
                        "cluster_id": 7,
                        "member_conv_ids": ["c1", "c2", "c3", "c4", "c5", "c6"],
                        "exemplar_conv_ids": ["c1", "c4"],
                        "suggested_name": "배송 문의",
                        "workflow_signal": {"has_escalation_cases": True},
                        "quality": {},
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    (preprocessing_dir / "preprocessed_data.json").write_text(
        json.dumps(
            {
                "conversations": [
                    {"id": "c1", "ended_status": "resolved", "workflow_signal": {"requires_payment_check": True}},
                    {"id": "c2", "ended_status": "resolved", "workflow_signal": {"requires_payment_check": True}},
                    {"id": "c3", "ended_status": "resolved", "workflow_signal": {"requires_payment_check": True}},
                    {"id": "c4", "ended_status": "escalated", "workflow_signal": {"has_escalation_cases": True}},
                    {"id": "c5", "ended_status": "escalated", "workflow_signal": {"has_escalation_cases": True}},
                    {"id": "c6", "ended_status": "escalated", "workflow_signal": {"has_escalation_cases": True}},
                ]
            }
        ),
        encoding="utf-8",
    )
    upstream_manifest = intent_dir / "manifest.json"
    upstream_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__run",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "11",
                "payload": {"artifact_path": "clusters.json"},
            }
        ),
        encoding="utf-8",
    )

    result = run(str(upstream_manifest))

    output_dir = Path(cast(str, result["artifact_manifest_path"])).parent
    clusters = json.loads((output_dir / "clusters.json").read_text(encoding="utf-8"))
    report = json.loads((output_dir / "flow_split_report.json").read_text(encoding="utf-8"))
    assert len(clusters["clusters"]) == 1
    assert report["splitCount"] == 0
    assert report["splitStrategy"] == "conservative"
    assert clusters["clusters"][0]["workflow_signal"]["requires_payment_check"] is True
    assert clusters["clusters"][0]["workflow_signal"]["has_escalation_cases"] is True


def test_flow_splitting_expanded_strategy_splits_large_signal_groups_by_sequence(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_FLOW_SPLIT_STRATEGY", "expanded")
    monkeypatch.setenv("PIPELINE_FLOW_MIN_SPLIT_SIZE", "4")
    monkeypatch.setenv("PIPELINE_FLOW_EXPANDED_MIN_SPLIT_SIZE", "2")
    base_dir = artifact_root / "domain_pack_generation" / "manual__run"
    intent_dir = base_dir / "intent_discovery"
    preprocessing_dir = base_dir / "preprocessing"
    intent_dir.mkdir(parents=True)
    preprocessing_dir.mkdir(parents=True)
    member_ids = [f"c{index}" for index in range(1, 9)]
    (intent_dir / "clusters.json").write_text(
        json.dumps(
            {
                "clusters": [
                    {
                        "cluster_id": 7,
                        "member_conv_ids": member_ids,
                        "exemplar_conv_ids": member_ids[:3],
                        "suggested_name": "요금 문의",
                        "label_score": 0.9,
                        "keywords": ["요금", "납부", "변경"],
                        "quality": {
                            "interpretability_score": 0.8,
                            "workflow_consistency_score": 0.8,
                        },
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    (preprocessing_dir / "preprocessed_data.json").write_text(
        json.dumps(
            {
                "conversations": [
                    {
                        "id": "c1",
                        "ended_status": "resolved",
                        "workflow_signal": {},
                        "flow_events": ["확인질문", "정책안내", "해결"],
                    },
                    {
                        "id": "c2",
                        "ended_status": "resolved",
                        "workflow_signal": {},
                        "flow_events": ["확인질문", "정책안내", "해결"],
                    },
                    {
                        "id": "c3",
                        "ended_status": "resolved",
                        "workflow_signal": {},
                        "flow_events": ["확인질문", "추가정보요청", "해결"],
                    },
                    {
                        "id": "c4",
                        "ended_status": "resolved",
                        "workflow_signal": {},
                        "flow_events": ["확인질문", "추가정보요청", "해결"],
                    },
                    {
                        "id": "c5",
                        "ended_status": "resolved",
                        "workflow_signal": {},
                        "flow_events": ["확인질문", "불만표현", "해결"],
                    },
                    {
                        "id": "c6",
                        "ended_status": "resolved",
                        "workflow_signal": {},
                        "flow_events": ["확인질문", "불만표현", "해결"],
                    },
                    {
                        "id": "c7",
                        "ended_status": "resolved",
                        "workflow_signal": {},
                        "flow_events": ["확인질문", "예외처리", "해결"],
                    },
                    {
                        "id": "c8",
                        "ended_status": "resolved",
                        "workflow_signal": {},
                        "flow_events": ["확인질문", "예외처리", "해결"],
                    },
                ]
            }
        ),
        encoding="utf-8",
    )
    upstream_manifest = intent_dir / "manifest.json"
    upstream_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__run",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "11",
                "payload": {"artifact_path": "clusters.json"},
            }
        ),
        encoding="utf-8",
    )

    result = run(str(upstream_manifest))

    output_dir = Path(cast(str, result["artifact_manifest_path"])).parent
    clusters = json.loads((output_dir / "clusters.json").read_text(encoding="utf-8"))
    entrypoints = json.loads((output_dir / "workflow_entrypoints.json").read_text(encoding="utf-8"))
    report = json.loads((output_dir / "flow_split_report.json").read_text(encoding="utf-8"))
    assert len(clusters["clusters"]) == 4
    assert report["sequenceSplitCount"] == 4
    assert report["workflowConfidenceAvg"] > 0.0
    assert entrypoints["workflowEntryPoints"][0]["confidenceComponents"]
    assert "needsHumanReview" in entrypoints["workflowEntryPoints"][0]


def test_flow_grouping_keeps_residual_small_groups() -> None:
    grouped = flow_splitting._flow_groups(
        {
            "member_conv_ids": ["r1", "r2", "r3", "e1", "e2", "e3", "o1"],
            "workflow_signal": {"has_escalation_cases": True, "ignored": False},
        },
        {
            "r1": {"ended_status": "resolved"},
            "r2": {"ended_status": "resolved"},
            "r3": {"ended_status": "resolved"},
            "e1": {"ended_status": "escalated"},
            "e2": {"ended_status": "escalated"},
            "e3": {"ended_status": "escalated"},
            "o1": {"ended_status": "abandoned"},
        },
        strategy="signal",
        min_split_size=3,
    )

    assert set(grouped) == {
        "resolved:has_escalation_cases",
        "escalated:has_escalation_cases",
        "mixed_residual",
    }
    assert grouped["mixed_residual"] == ["o1"]


def test_flow_grouping_prefers_conversation_workflow_signal() -> None:
    grouped = flow_splitting._flow_groups(
        {
            "member_conv_ids": ["c1", "c2", "c3", "c4", "c5", "c6"],
            "workflow_signal": {"cluster_level": True},
        },
        {
            "c1": {"ended_status": "resolved", "workflow_signal": {"slot_collection": True}},
            "c2": {"ended_status": "resolved", "workflow_signal": {"slot_collection": True}},
            "c3": {"ended_status": "resolved", "workflow_signal": {"slot_collection": True}},
            "c4": {"ended_status": "resolved", "workflow_signal": {"risk_check": True}},
            "c5": {"ended_status": "resolved", "workflow_signal": {"risk_check": True}},
            "c6": {"ended_status": "resolved", "workflow_signal": {"risk_check": True}},
        },
        strategy="signal",
        min_split_size=3,
    )

    assert set(grouped) == {"resolved:slot_collection", "resolved:risk_check"}


def test_flow_grouping_falls_back_to_observed_event_sequence_when_signal_groups_are_sparse() -> None:
    grouped = flow_splitting._flow_groups(
        {
            "member_conv_ids": ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"],
            "workflow_signal": {},
        },
        {
            "a1": {
                "ended_status": "resolved",
                "workflow_signal": {"minor_1": True},
                "flow_events": ["확인질문", "정책안내", "해결"],
            },
            "a2": {
                "ended_status": "resolved",
                "workflow_signal": {"minor_2": True},
                "flow_events": ["확인질문", "정책안내", "해결"],
            },
            "a3": {
                "ended_status": "resolved",
                "workflow_signal": {"minor_3": True},
                "flow_events": ["확인질문", "정책안내", "해결"],
            },
            "a4": {
                "ended_status": "resolved",
                "workflow_signal": {"minor_4": True},
                "flow_events": ["확인질문", "정책안내", "해결"],
            },
            "b1": {
                "ended_status": "resolved",
                "workflow_signal": {"minor_5": True},
                "flow_events": ["확인질문", "추가정보요청", "해결"],
            },
            "b2": {
                "ended_status": "resolved",
                "workflow_signal": {"minor_6": True},
                "flow_events": ["확인질문", "추가정보요청", "해결"],
            },
            "b3": {
                "ended_status": "resolved",
                "workflow_signal": {"minor_7": True},
                "flow_events": ["확인질문", "추가정보요청", "해결"],
            },
            "b4": {
                "ended_status": "resolved",
                "workflow_signal": {"minor_8": True},
                "flow_events": ["확인질문", "추가정보요청", "해결"],
            },
        },
        strategy="signal",
        min_split_size=3,
    )

    assert set(grouped) == {
        "sequence:확인질문>정책안내>해결",
        "sequence:확인질문>추가정보요청>해결",
    }
    assert flow_splitting._split_label("sequence:확인질문>정책안내>해결") == "요청확인 · 기준확인 · 결과안내 흐름"


def test_flow_grouping_splits_repeated_action_object_frames_before_sequence_fallback() -> None:
    grouped = flow_splitting._flow_groups(
        {
            "member_conv_ids": ["a1", "a2", "a3", "b1", "b2", "b3"],
            "workflow_signal": {},
        },
        {
            "a1": {
                "ended_status": "resolved",
                "workflow_signal": {},
                "flow_events": ["확인질문", "해결"],
                "action_object_frame": {"object": "요금", "action": "확인", "confidence": 0.9},
            },
            "a2": {
                "ended_status": "resolved",
                "workflow_signal": {},
                "flow_events": ["확인질문", "해결"],
                "action_object_frame": {"object": "요금", "action": "확인", "confidence": 0.8},
            },
            "a3": {
                "ended_status": "resolved",
                "workflow_signal": {},
                "flow_events": ["확인질문", "해결"],
                "action_object_frame": {"object": "요금", "action": "확인", "confidence": 0.7},
            },
            "b1": {
                "ended_status": "resolved",
                "workflow_signal": {},
                "flow_events": ["확인질문", "해결"],
                "action_object_frame": {"object": "주소", "action": "변경", "confidence": 0.9},
            },
            "b2": {
                "ended_status": "resolved",
                "workflow_signal": {},
                "flow_events": ["확인질문", "해결"],
                "action_object_frame": {"object": "주소", "action": "변경", "confidence": 0.8},
            },
            "b3": {
                "ended_status": "resolved",
                "workflow_signal": {},
                "flow_events": ["확인질문", "해결"],
                "action_object_frame": {"object": "주소", "action": "변경", "confidence": 0.7},
            },
        },
        strategy="signal",
        min_split_size=3,
    )

    assert set(grouped) == {
        "action_object:요금>확인",
        "action_object:주소>변경",
    }
    assert flow_splitting._split_label("action_object:요금>확인") == "요금 확인 기준"


def test_flow_grouping_splits_repeated_actions_when_objects_are_unstable() -> None:
    grouped = flow_splitting._flow_groups(
        {
            "member_conv_ids": ["a1", "a2", "a3", "b1", "b2", "b3", "u1"],
            "workflow_signal": {},
        },
        {
            "a1": {
                "ended_status": "resolved",
                "workflow_signal": {},
                "action_object_frame": {"object": "대상1", "action": "변경", "confidence": 0.7},
            },
            "a2": {
                "ended_status": "resolved",
                "workflow_signal": {},
                "action_object_frame": {"object": "대상2", "action": "변경", "confidence": 0.7},
            },
            "a3": {
                "ended_status": "resolved",
                "workflow_signal": {},
                "action_object_frame": {"object": "대상3", "action": "변경", "confidence": 0.7},
            },
            "b1": {
                "ended_status": "resolved",
                "workflow_signal": {},
                "action_object_frame": {"object": "대상4", "action": "결제", "confidence": 0.7},
            },
            "b2": {
                "ended_status": "resolved",
                "workflow_signal": {},
                "action_object_frame": {"object": "대상5", "action": "결제", "confidence": 0.7},
            },
            "b3": {
                "ended_status": "resolved",
                "workflow_signal": {},
                "action_object_frame": {"object": "대상6", "action": "결제", "confidence": 0.7},
            },
            "u1": {
                "ended_status": "resolved",
                "workflow_signal": {},
                "action_object_frame": {"object": "대상7", "action": "확인", "confidence": 0.4},
            },
        },
        strategy="signal",
        min_split_size=3,
    )

    assert set(grouped) == {"action:변경", "action:결제", "mixed_residual"}
    assert grouped["mixed_residual"] == ["u1"]
    assert flow_splitting._split_label("action:변경") == "변경 처리"


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


def test_duplicate_generated_labels_fallback_lower_confidence_duplicate_only() -> None:
    clusters = [
        {
            "workflow_entrypoint_id": "entrypoint-1",
            "name": "금액 결제 문의",
            "suggested_name": "금액 결제 문의",
            "label_score": 0.78,
            "label_evidence_coverage": 0.66,
            "member_conv_ids": ["c1", "c2", "c3"],
        },
        {
            "workflow_entrypoint_id": "entrypoint-2",
            "suggested_name": "금액 결제 문의",
            "label_score": 0.60,
            "label_evidence_coverage": 0.28,
            "label_action_object_validity": 0.74,
            "member_conv_ids": ["c4", "c5"],
            "flow_split_key": "mixed_residual",
            "label_candidates": [{"name": "금액 결제 문의", "source": "action_object_frame"}],
        },
    ]

    flow_splitting._resolve_duplicate_generated_labels(
        clusters,
        {
            "c4": {"flow_events": ["확인질문", "정책안내"]},
            "c5": {"flow_events": ["확인질문", "확인질문"]},
        },
    )

    assert clusters[0]["suggested_name"] == "금액 결제 문의"
    assert clusters[1]["suggested_name"] == "미분류 문의"
    assert isinstance(clusters[1]["label_score"], float)
    assert clusters[1]["label_score"] <= 0.45


def test_duplicate_generated_labels_keep_evidence_backed_review_candidates() -> None:
    clusters = [
        {
            "workflow_entrypoint_id": "entrypoint-1",
            "suggested_name": "요금 납부 문의",
            "label_score": 0.78,
            "label_member_evidence_coverage": 0.72,
            "label_object_action_joint_coverage": 0.70,
            "label_action_object_validity": 0.80,
            "member_conv_ids": ["c1", "c2", "c3"],
        },
        {
            "workflow_entrypoint_id": "entrypoint-2",
            "suggested_name": "요금 납부 문의",
            "label_score": 0.58,
            "label_member_evidence_coverage": 0.42,
            "label_object_action_joint_coverage": 0.66,
            "label_action_object_validity": 0.74,
            "member_conv_ids": ["c4", "c5"],
            "label_candidates": [{"name": "요금 납부 문의", "source": "action_object_frame"}],
        },
    ]

    flow_splitting._resolve_duplicate_generated_labels(clusters, {})

    assert clusters[0]["suggested_name"] == "요금 납부 문의"
    assert clusters[1]["suggested_name"] == "요금 납부 문의"
    assert clusters[1]["label_validation_status"] == "needs_review"
    assert clusters[1].get("label_source") != "duplicate_weak_label_flow_fallback"


def test_duplicate_generated_labels_keep_high_joint_term_frequency_label() -> None:
    clusters = [
        {
            "workflow_entrypoint_id": "entrypoint-1",
            "suggested_name": "금액 결제 문의",
            "label_score": 0.78,
            "label_member_evidence_coverage": 0.80,
            "label_object_action_joint_coverage": 0.75,
            "label_action_object_validity": 0.80,
            "member_conv_ids": ["c1", "c2", "c3"],
        },
        {
            "workflow_entrypoint_id": "entrypoint-2",
            "suggested_name": "금액 결제 문의",
            "label_score": 0.735,
            "label_member_evidence_coverage": 0.875,
            "label_object_action_joint_coverage": 0.75,
            "label_action_object_validity": 0.35,
            "member_conv_ids": ["c4", "c5", "c6", "c7"],
            "flow_split_key": "requires_payment_check|action:결제",
            "label_candidates": [{"name": "금액 결제 문의", "source": "term_frequency"}],
        },
    ]

    flow_splitting._resolve_duplicate_generated_labels(clusters, {})

    assert clusters[1]["suggested_name"] == "금액 결제 문의"
    assert clusters[1]["label_validation_status"] == "needs_review"
    assert clusters[1].get("label_source") != "duplicate_weak_label_flow_fallback"


def test_novel_outlier_candidates_are_never_auto_labels() -> None:
    clusters: list[dict[str, object]] = [
        {
            "suggested_name": "카드 결제 문의",
            "label_validation_status": "auto_acceptable",
            "is_novel_outlier_candidate": True,
        },
        {
            "suggested_name": "카드 결제 문의",
            "label_validation_status": "auto_acceptable",
        },
    ]

    flow_splitting._enforce_review_only_labels(clusters)

    assert clusters[0]["label_validation_status"] == "needs_review"
    assert clusters[1]["label_validation_status"] == "auto_acceptable"


def test_split_label_terms_normalize_generic_amount_withdrawal_and_overage_forms() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2", "c3"],
        {
            "c1": {"customer_problem_text": "최소 결제 금액이 얼마죠"},
            "c2": {"customer_problem_text": "통장에서 인출해가시면 결제되나요"},
            "c3": {"customer_problem_text": "결제 금액이 초과돼 확인 부탁드립니다"},
        },
    )

    assert "얼마죠" not in label["name"]
    assert "인출해가시면" not in label["name"]
    assert "초과돼" not in label["name"]
    assert any(term in label["name"] for term in ("금액", "출금", "초과", "결제"))


def test_split_label_terms_filter_slot_identifiers_and_colloquial_endings() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2", "c3"],
        {
            "c1": {"customer_problem_text": "카드번호로 납부하려구요 결제 문의"},
            "c2": {"customer_problem_text": "납부 하려구 결제 금액이 얼만지 문의"},
            "c3": {"customer_problem_text": "것만 확인하고 납부 결제 문의"},
        },
    )

    assert "카드번호" not in label["name"]
    assert "하려구" not in label["name"]
    assert "것만" not in label["name"]
    assert "얼만" not in label["name"]
    assert any(term in label["name"] for term in ("납부", "결제", "금액"))


def test_regenerated_label_infers_action_from_text_when_term_label_is_object_only() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2", "c3"],
        {
            "c1": {"customer_problem_text": "이번 달 결제 금액이 얼마인가요"},
            "c2": {"customer_problem_text": "납부 금액 확인하고 싶어요"},
            "c3": {"customer_problem_text": "청구 금액 결제가 맞나요"},
        },
    )

    assert label["name"] == "금액 결제 문의"
    assert label["objectActionJointCoverage"] == 1.0
    assert not flow_splitting._split_label_auto_acceptable(label)


def test_regenerated_label_removes_discourse_noise_from_action_object_frame() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {
                "customer_problem_text": "요금 확인하니까 결제 문의",
                "action_object_frame": {"object": "요금 확인하니까", "action": "결제", "confidence": 0.9},
            },
            "c2": {
                "customer_problem_text": "요금 결제 내역 확인",
                "action_object_frame": {"object": "요금", "action": "결제", "confidence": 0.85},
            },
        },
    )

    assert label["name"] == "요금 결제 문의"
    assert "확인하니까" not in label["name"]


def test_regenerated_label_downgrades_object_frame_when_only_discourse_object_remains() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {
                "customer_problem_text": "아니면 말을 결제 문의",
                "action_object_frame": {"object": "아니면 말을", "action": "결제", "confidence": 0.9},
            },
            "c2": {
                "customer_problem_text": "결제 문의",
                "action_object_frame": {"object": "말을", "action": "결제", "confidence": 0.85},
            },
        },
    )

    assert "아니면" not in label["name"]
    assert "말" not in label["name"]
    assert label["name"] == "결제 문의"


def test_regenerated_label_filters_question_tail_noise_from_action_object_frame() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {
                "customer_problem_text": "할인 있을까 뭐예 결제 문의",
                "action_object_frame": {"object": "할인 있을까 뭐예", "action": "결제", "confidence": 0.9},
            },
            "c2": {
                "customer_problem_text": "할인 결제 확인",
                "action_object_frame": {"object": "할인", "action": "결제", "confidence": 0.85},
            },
        },
    )

    assert label["name"] == "할인 결제 문의"
    assert "있을까" not in label["name"]
    assert "뭐예" not in label["name"]


def test_split_label_auto_acceptance_requires_strong_object_action_evidence() -> None:
    assert flow_splitting._split_label_auto_acceptable(
        {
            "name": "요금 결제 문의",
            "score": 0.82,
            "evidenceCoverage": 0.75,
            "objectActionJointCoverage": 0.75,
            "actionObjectValidity": 0.80,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "무제한 있다고 신청 문의",
            "score": 0.70,
            "evidenceCoverage": 0.40,
            "objectActionJointCoverage": 0.45,
            "actionObjectValidity": 0.76,
            "specificity": 1.0,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "정보들 정보확인 문의",
            "score": 0.83,
            "evidenceCoverage": 0.50,
            "objectActionJointCoverage": 1.0,
            "actionObjectValidity": 1.0,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "예약 정보확인 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "카드 품목별 한번 간단하게 확인 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 1.0,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "그랬는데 신청 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "요청해가지고 결제 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "그래가지고 결제 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "할인 나간다 신청 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "전에 선택약정 확인 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "거는 되네 결제 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "개월 없고 결제 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "요금제 조금 비싼 변경 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "개월 결제 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "카드 쓰면 환불 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "요금 삼성카드 해요 변경 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 1.0,
        }
    )


def test_split_label_terms_compact_related_terms_and_speech_endings() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {"customer_problem_text": "카드 카드사 결제 문의"},
            "c2": {"customer_problem_text": "카드사 결제 변경됐어"},
        },
    )

    assert label["name"] == "카드사 결제 문의"
    assert "카드 카드사" not in label["name"]
    assert "됐어" not in label["name"]


def test_term_frequency_label_orders_object_before_action() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {"customer_problem_text": "결제 금액 확인 부탁드립니다"},
            "c2": {"customer_problem_text": "결제 금액이 얼마인가요"},
        },
    )

    assert label["name"] == "금액 결제 문의"


def test_review_safe_label_rejects_weak_information_check_surface_fragment() -> None:
    noisy_label = {
        "name": "문의하나 정보확인 문의",
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
                "name": "문의하나 정보확인 문의",
                "score": 0.68,
                "evidenceCoverage": 0.67,
                "objectActionJointCoverage": 0.33,
                "actionObjectValidity": 0.80,
                "source": "action_object_frame",
            }
        ],
    }

    label = flow_splitting._review_safe_generated_label(noisy_label, ["c1"], {}, "no_signal")

    assert label["name"] == "미분류 문의"
    assert label["candidates"][0]["source"] == "weak_label_flow_fallback"


def test_duplicate_fallback_name_does_not_repeat_review_suffix() -> None:
    label = flow_splitting._unique_duplicate_fallback_name(
        "결제 처리 문의",
        {"결제 처리 문의"},
    )

    assert label == "결제 처리 문의 2"
    assert "검토" not in label


def test_split_label_coverage_supports_canonical_action_aliases() -> None:
    candidate = flow_splitting._score_split_label_candidate(
        name="카드 사용 가능여부확인 문의",
        terms=["카드", "사용", "가능여부확인"],
        member_ids=["c1", "c2"],
        preprocessed_index={
            "c1": {"customer_problem_text": "카드를 사용할 수 있나요?"},
            "c2": {"customer_problem_text": "카드 사용 가능한가요?"},
        },
        source="action_object_frame",
        frame_candidate={
            "frame": {"object": "카드 사용", "action": "가능여부확인", "confidence": 0.9},
            "evidenceCoverage": 1.0,
        },
    )

    assert candidate["evidenceCoverage"] == 1.0
    assert candidate["memberEvidenceCoverage"] == 1.0
    assert candidate["actionCoverage"] == 1.0
    assert candidate["objectActionJointCoverage"] == 1.0


def test_novel_label_falls_back_to_flow_when_terms_are_weak() -> None:
    label = flow_splitting._stabilized_novel_label(
        {
            "source_type": "outlier_flow",
            "candidate_key": "outlier_flow:확인질문>정책안내:5",
            "suggested_name": "관측 흐름 미분류 문의",
        },
        {
            "name": "질문 생기면 문의",
            "score": 0.53,
            "evidenceCoverage": 0.33,
            "actionObjectValidity": 0.35,
            "candidates": [],
        },
    )

    assert label["name"] == "미분류 문의"
    assert label["score"] <= 0.45


def test_extend_unique_handles_malformed_existing_values_and_limit() -> None:
    target = {"values": "bad"}

    flow_splitting._extend_unique(target, "values", ["a", "b", "c"], limit=2)

    assert target["values"] == ["a", "b"]


def test_flow_splitting_helpers_handle_malformed_inputs(tmp_path: Path) -> None:
    runtime_config = PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        callback_enabled=False,
    )
    context = StageContext(
        dag_id="dag",
        run_id="run",
        stage_name="flow_splitting",
        workspace_id=None,
        dataset_id=None,
        pipeline_job_id=None,
    )
    bad_json = tmp_path / "bad.json"
    bad_json.write_text("{not-json", encoding="utf-8")
    list_json = tmp_path / "list.json"
    list_json.write_text("[]", encoding="utf-8")
    preprocessing_dir = tmp_path / "dag" / "run" / "preprocessing"
    preprocessing_dir.mkdir(parents=True)
    (preprocessing_dir / "preprocessed_data.json").write_text(json.dumps({"conversations": {}}), encoding="utf-8")

    assert flow_splitting._read_preprocessed_index(runtime_config, context) == {}
    assert flow_splitting._string_list("not-list") == []
    with pytest.raises(PipelineStageError, match="Failed to read JSON artifact"):
        flow_splitting._read_json(bad_json)
    with pytest.raises(PipelineStageError, match="JSON artifact must be an object"):
        flow_splitting._read_json(list_json)
