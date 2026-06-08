from __future__ import annotations

import json
from pathlib import Path
from typing import cast

import numpy as np
import pytest

from pipeline.common.exceptions import PipelineStageError
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
