from __future__ import annotations

import json
from pathlib import Path
from typing import cast

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
    assert report["workflowSeparability"] == 1.0
    assert clusters["flow_split_metrics"]["workflowSeparability"] == 1.0
    assert clusters["clusters"][0]["source_cluster_id"] == 7
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
    assert entrypoints["workflowEntryPoints"][0]["splitReason"] == "mixed_flow"


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
    )

    assert set(grouped) == {"resolved:slot_collection", "resolved:risk_check"}


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
