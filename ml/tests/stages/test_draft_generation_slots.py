from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.stages.draft_generation.main import (
    _build_candidate,
    _build_intents,
    _build_slot_draft,
    _build_workflow_draft,
    run,
)
from pipeline.stages.publish_candidate.main import validate_candidate
from tests.helpers.draft_generation import (
    _stage_context,
    _write_clusters,
    _write_preprocessed,
    _write_upstream_manifest,
)


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
