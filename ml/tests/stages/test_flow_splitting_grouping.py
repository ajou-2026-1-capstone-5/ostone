from __future__ import annotations

import json
from pathlib import Path
from typing import cast

import pytest

from pipeline.stages.flow_splitting import main as flow_splitting
from pipeline.stages.flow_splitting.main import run


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
