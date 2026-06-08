from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.stages.draft_generation.main import run
from tests.helpers.draft_generation import (
    _preprocessed_conv,
    _write_clusters,
    _write_preprocessed,
    _write_upstream_manifest,
)


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
