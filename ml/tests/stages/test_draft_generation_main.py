from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.draft_generation.main import (
    _build_intents,
    _hydrate_case,
    _read_clusters,
    _read_preprocessed_index,
    _resolve_cases_per_intent,
)


def _runtime_config(tmp_path: Path) -> PipelineRuntimeConfig:
    return PipelineRuntimeConfig(artifact_root=tmp_path / "artifacts", backend_base_url="http://backend:8080")


def _stage_context() -> StageContext:
    return StageContext(dag_id="dag", run_id="run1", stage_name="draft_generation", workspace_id="ws1")


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
