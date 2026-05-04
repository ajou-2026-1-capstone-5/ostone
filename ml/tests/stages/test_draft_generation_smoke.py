"""Integration smoke: intent_discovery → draft_generation pipeline path.

Verifies that draft_generation produces a candidate.json whose
intentDraft.intents[*].representativeCases contains up to 3 cases,
each with all required fields.

publish_candidate is excluded from this smoke because packKey=None (U-006 Deferred)
causes validate_candidate to raise before the SKIPPED path is reachable.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.stages.draft_generation.main import run


def _write_upstream_artifacts(artifact_root: Path) -> Path:
    dag_id = "smoke"
    run_id = "run1"

    preprocessed_dir = artifact_root / dag_id / run_id / "preprocessing"
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

    intent_dir = artifact_root / dag_id / run_id / "intent_discovery"
    intent_dir.mkdir(parents=True)
    clusters = [
        {
            "cluster_id": 0,
            "suggested_name": "환불 문의",
            "suggested_description": "환불 관련",
            "exemplar_conv_ids": ["conv_0", "conv_1", "conv_2"],
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
                "workspace_id": "ws-smoke",
                "dataset_id": None,
                "pipeline_job_id": None,
            }
        ),
        encoding="utf-8",
    )
    return manifest_path


def test_draft_generation_produces_representative_cases(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    artifact_root = tmp_path / "artifacts"
    manifest_path = _write_upstream_artifacts(artifact_root)

    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_CALLBACK_ENABLED", "false")

    result = run(upstream_manifest_path=str(manifest_path))

    candidate_path = Path(result["candidateArtifactPath"])
    assert candidate_path.exists()

    candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
    intents = candidate["intentDraft"]["intents"]
    assert len(intents) >= 1, f"intent가 없음: {candidate}"

    cases = intents[0]["representativeCases"]
    assert len(cases) == 3, f"대표 케이스 3개 필요, 실제: {len(cases)}"

    required_fields = {"conversationId", "canonicalText", "customerProblemText", "endedStatus"}
    for case in cases:
        missing = required_fields - set(case.keys())
        assert not missing, f"필드 누락: {missing}, case: {case}"


def test_draft_generation_partial_hydration_smoke(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    artifact_root = tmp_path / "artifacts"
    dag_id = "smoke2"
    run_id = "run1"

    preprocessed_dir = artifact_root / dag_id / run_id / "preprocessing"
    preprocessed_dir.mkdir(parents=True)
    (preprocessed_dir / "preprocessed_data.json").write_text(
        json.dumps({"schema_version": "1.0", "conversations": [{"id": "c1", "canonical_text": "t", "customer_problem_text": "p", "ended_status": None}]}),
        encoding="utf-8",
    )

    intent_dir = artifact_root / dag_id / run_id / "intent_discovery"
    intent_dir.mkdir(parents=True)
    (intent_dir / "clusters.json").write_text(
        json.dumps({"schema_version": "1.0", "clusters": [{"cluster_id": 0, "suggested_name": "테스트", "suggested_description": None, "exemplar_conv_ids": ["c1", "missing_id"]}]}),
        encoding="utf-8",
    )
    manifest_path = intent_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps({"dag_id": dag_id, "run_id": run_id, "stage_name": "intent_discovery", "workspace_id": None, "dataset_id": None, "pipeline_job_id": None}),
        encoding="utf-8",
    )

    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_CALLBACK_ENABLED", "false")

    result = run(upstream_manifest_path=str(manifest_path))

    candidate = json.loads(Path(result["candidateArtifactPath"]).read_text(encoding="utf-8"))
    cases = candidate["intentDraft"]["intents"][0]["representativeCases"]
    assert len(cases) == 1, f"hydration 성공한 1개만 포함, 실제: {len(cases)}"
    assert cases[0]["conversationId"] == "c1"
