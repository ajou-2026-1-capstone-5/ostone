"""Integration smoke: draft_generation → publish_candidate via dev_bootstrap fixture.

Uses the dev_bootstrap artifact fixture to verify the pipeline chain
intent_discovery → draft_generation → publish_candidate(callback_disabled).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import cast

import pytest

from pipeline.stages.draft_generation.main import run
from pipeline.stages.publish_candidate.main import validate_candidate


@pytest.fixture
def dev_bootstrap_artifacts(tmp_path: Path) -> Path:
    dag_id = "dev_bootstrap"
    run_id = "smoke_run"

    preprocessed_dir = tmp_path / dag_id / run_id / "preprocessing"
    preprocessed_dir.mkdir(parents=True)
    conversations = [
        {
            "id": f"conv_{i}",
            "canonical_text": f"상담 내용 {i}",
            "customer_problem_text": f"고객 문제 {i}",
            "ended_status": "resolved",
        }
        for i in range(3)
    ]
    (preprocessed_dir / "preprocessed_data.json").write_text(
        json.dumps({"schema_version": "1.0", "conversations": conversations}),
        encoding="utf-8",
    )

    intent_dir = tmp_path / dag_id / run_id / "intent_discovery"
    intent_dir.mkdir(parents=True)
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "환불 문의",
            "suggested_description": "환불 관련",
            "exemplar_conv_ids": ["conv_0", "conv_1", "conv_2"],
            "workflow_signal": {
                "requires_user_identification": False,
                "requires_payment_check": True,
                "has_escalation_cases": False,
            },
        }
    ]
    (intent_dir / "clusters.json").write_text(
        json.dumps({"schema_version": "1.0", "clusters": clusters}),
        encoding="utf-8",
    )
    manifest_path = intent_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "dag_id": dag_id,
                "run_id": run_id,
                "stage_name": "intent_discovery",
                "workspace_id": "ws-bootstrap",
                "dataset_id": "ds-bootstrap",
                "pipeline_job_id": None,
            }
        ),
        encoding="utf-8",
    )
    return manifest_path


def test_dev_bootstrap_draft_to_publish_smoke(
    dev_bootstrap_artifacts: Path,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_CALLBACK_ENABLED", "false")

    result = run(upstream_manifest_path=str(dev_bootstrap_artifacts))

    candidate = json.loads(Path(cast(str, result["candidateArtifactPath"])).read_text(encoding="utf-8"))
    validate_candidate(candidate)

    assert candidate["domainPackDraft"]["packKey"] == "pack_wsws-bootstrap_dsds-bootstrap"
    assert len(candidate["workflowDraft"]["workflows"]) >= 1
    intent_codes = {intent["intentCode"] for intent in candidate["intentDraft"]["intents"]}
    for wf in candidate["workflowDraft"]["workflows"]:
        assert wf.get("intentCode"), "workflow must have non-empty intentCode"
        assert wf["intentCode"] in intent_codes, "workflow intentCode must reference existing intent"
    evidence_items = json.loads(candidate["workflowDraft"]["workflows"][0]["evidenceJson"])
    assert isinstance(evidence_items, list)
    assert len(evidence_items) > 0


def test_reproducibility_evidence_json(
    dev_bootstrap_artifacts: Path,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_CALLBACK_ENABLED", "false")

    result1 = run(upstream_manifest_path=str(dev_bootstrap_artifacts))
    candidate1 = json.loads(Path(cast(str, result1["candidateArtifactPath"])).read_text(encoding="utf-8"))
    evidence1 = [w["evidenceJson"] for w in candidate1["workflowDraft"]["workflows"]]

    result2 = run(upstream_manifest_path=str(dev_bootstrap_artifacts))
    candidate2 = json.loads(Path(cast(str, result2["candidateArtifactPath"])).read_text(encoding="utf-8"))
    evidence2 = [w["evidenceJson"] for w in candidate2["workflowDraft"]["workflows"]]

    assert evidence1 == evidence2
