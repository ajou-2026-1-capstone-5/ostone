from __future__ import annotations

# pyright: reportMissingTypeStubs=false, reportAny=false
import json
from pathlib import Path
from typing import TypedDict, TypeGuard, cast

import numpy as np
import pytest

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.intent_discovery.io import (
    DEFAULT_CLUSTER_ARTIFACT,
    DEFAULT_EMBEDDING_ARTIFACT,
    DEFAULT_PREPROCESSED_ARTIFACT,
    read_preprocessed_artifact,
    write_clusters_artifact,
)
from pipeline.stages.intent_discovery.types import (
    ClusterQuality,
    ClusterResult,
    IntentDiscoveryStats,
    NovelIntentCandidate,
)
from pipeline.stages.preprocessing.types import FLOW_SIGNATURE_DIM


class OutputArtifact(TypedDict):
    clusters: list[dict[str, object]]
    novel_candidates: list[dict[str, object]]
    stats: dict[str, object]
    embeddings_path: str


def test_should_read_preprocessed_artifact(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context("intent_discovery")
    artifact_path = _preprocessing_dir(runtime_config, context) / DEFAULT_PREPROCESSED_ARTIFACT
    artifact_path.parent.mkdir(parents=True)
    _ = artifact_path.write_text(
        json.dumps(
            {
                "conversations": [
                    _preprocessed_payload("c1", [1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 1)),
                    _preprocessed_payload("c2", [0.0, 1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 2)),
                ]
            }
        ),
        encoding="utf-8",
    )

    conversations, flow_signatures = read_preprocessed_artifact(runtime_config, context)

    assert [conversation.id for conversation in conversations] == ["c1", "c2"]
    assert conversations[0].workflow_signal == {"requires_payment_check": True}
    assert conversations[0].flow_events == ("확인질문", "정책안내")
    assert flow_signatures.shape == (2, FLOW_SIGNATURE_DIM)
    assert flow_signatures.dtype == np.float32
    first_signature = cast(object, flow_signatures[0])
    expected_signature = cast(object, np.asarray(conversations[0].flow_signature, dtype=np.float32))
    if not _is_ndarray(first_signature) or not _is_ndarray(expected_signature):
        raise AssertionError("flow signatures must be numpy arrays")
    assert np.array_equal(first_signature, expected_signature)


def test_should_raise_when_preprocessed_artifact_is_missing(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context("intent_discovery")

    with pytest.raises(PipelineStageError):
        _ = read_preprocessed_artifact(runtime_config, context)


def test_should_write_clusters_artifact(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context("intent_discovery")
    clusters = [
        ClusterResult(
            cluster_id=1,
            member_indices=(0, 1),
            member_conv_ids=("c1", "c2"),
            exemplar_conv_ids=("c1",),
            keywords=("refund", "order"),
            suggested_name="환불 문의",
            suggested_description="주문 환불 관련 문의",
            workflow_signal={"requires_payment_check": True},
            quality=ClusterQuality(
                interpretability_score=0.9,
                workflow_consistency_score=0.8,
                branching_explainability_score=0.7,
            ),
        ),
        ClusterResult(
            cluster_id=2,
            member_indices=(2,),
            member_conv_ids=("c3",),
            exemplar_conv_ids=("c3",),
            keywords=("delivery",),
            suggested_name="배송 문의",
            suggested_description="배송 상태 문의",
            workflow_signal={"has_escalation_cases": False},
            quality=ClusterQuality(
                interpretability_score=0.6,
                workflow_consistency_score=0.5,
                branching_explainability_score=None,
            ),
            review_hint="검토 필요",
        ),
    ]
    novel_candidates = [
        NovelIntentCandidate(
            candidate_key="outlier:1",
            source_type="outlier_cluster",
            candidate_size=1,
            suggested_name="기타 문의",
            member_conv_ids=("c4",),
        )
    ]
    stats = IntentDiscoveryStats(
        input_count=4,
        embedding_failed_count=0,
        cluster_count=2,
        outlier_count=1,
        outlier_rate=0.25,
        avg_interpretability_score=0.75,
        avg_workflow_consistency_score=0.65,
    )
    embeddings = np.arange(12, dtype=np.float32).reshape((4, 3))

    clusters_path = write_clusters_artifact(runtime_config, context, clusters, novel_candidates, stats, embeddings)
    output = _read_output(clusters_path)
    embeddings_path = clusters_path.parent / DEFAULT_EMBEDDING_ARTIFACT

    expected_path = runtime_config.artifact_root / "dag" / "run1" / "intent_discovery" / DEFAULT_CLUSTER_ARTIFACT
    assert clusters_path == expected_path
    assert clusters_path.exists()
    assert embeddings_path.exists()
    assert output["embeddings_path"] == DEFAULT_EMBEDDING_ARTIFACT
    assert len(output["clusters"]) == 2
    first_cluster = output["clusters"][0]
    assert first_cluster["member_conv_ids"] == ["c1", "c2"]
    assert first_cluster["quality"] == {
        "interpretability_score": 0.9,
        "workflow_consistency_score": 0.8,
        "branching_explainability_score": 0.7,
    }
    assert output["novel_candidates"] == [
        {
            "candidate_key": "outlier:1",
            "source_type": "outlier_cluster",
            "candidate_size": 1,
            "suggested_name": "기타 문의",
            "member_conv_ids": ["c4"],
        }
    ]
    assert output["stats"]["cluster_count"] == 2
    saved_embeddings = cast(object, np.load(embeddings_path))
    if not _is_ndarray(saved_embeddings):
        raise AssertionError("saved embeddings must be a numpy array")
    assert np.array_equal(saved_embeddings, embeddings)


def _runtime_config(tmp_path: Path) -> PipelineRuntimeConfig:
    return PipelineRuntimeConfig(artifact_root=tmp_path / "artifacts", backend_base_url="http://backend:8080")


def _context(stage_name: str) -> StageContext:
    return StageContext(dag_id="dag", run_id="run1", stage_name=stage_name, workspace_id="ws1", dataset_id="ds1")


def _preprocessing_dir(runtime_config: PipelineRuntimeConfig, context: StageContext) -> Path:
    return runtime_config.artifact_root / context.dag_id / context.run_id / "preprocessing"


def _preprocessed_payload(conversation_id: str, flow_signature: list[float]) -> dict[str, object]:
    return {
        "id": conversation_id,
        "dataset_id": "ds1",
        "channel": "chat",
        "ended_status": "resolved",
        "canonical_text": "환불 요청",
        "customer_problem_text": "환불 요청",
        "flow_signature": flow_signature,
        "flow_signature_dim": FLOW_SIGNATURE_DIM,
        "turn_count": 2,
        "customer_turn_count": 1,
        "pii_mask_count": 0,
        "filtered": False,
        "workflow_signal": {"requires_payment_check": True},
        "flow_events": ["확인질문", "정책안내"],
    }


def _read_output(clusters_path: Path) -> OutputArtifact:
    return cast(OutputArtifact, json.loads(clusters_path.read_text(encoding="utf-8")))


def test_should_raise_on_invalid_json(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context("intent_discovery")
    artifact_path = _preprocessing_dir(runtime_config, context) / DEFAULT_PREPROCESSED_ARTIFACT
    artifact_path.parent.mkdir(parents=True)
    _ = artifact_path.write_text("{ invalid json }", encoding="utf-8")

    with pytest.raises(PipelineStageError, match="Invalid preprocessed artifact JSON"):
        _ = read_preprocessed_artifact(runtime_config, context)


def test_should_raise_on_missing_conversations_field(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context("intent_discovery")
    artifact_path = _preprocessing_dir(runtime_config, context) / DEFAULT_PREPROCESSED_ARTIFACT
    artifact_path.parent.mkdir(parents=True)
    _ = artifact_path.write_text(json.dumps({"other": "data"}), encoding="utf-8")

    with pytest.raises(PipelineStageError, match="conversations must be a list"):
        _ = read_preprocessed_artifact(runtime_config, context)


def test_read_preprocessed_artifact_excludes_filtered_conversations(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context("intent_discovery")
    artifact_path = _preprocessing_dir(runtime_config, context) / DEFAULT_PREPROCESSED_ARTIFACT
    artifact_path.parent.mkdir(parents=True)
    rows = [
        _preprocessed_payload("kept", [1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 1)),
        {**_preprocessed_payload("filtered", [0.0] * FLOW_SIGNATURE_DIM), "filtered": True},
    ]
    artifact_path.write_text(json.dumps({"conversations": rows}), encoding="utf-8")

    conversations, flow_signatures = read_preprocessed_artifact(runtime_config, context)

    assert [conversation.id for conversation in conversations] == ["kept"]
    assert flow_signatures.shape == (1, FLOW_SIGNATURE_DIM)


def test_read_preprocessed_artifact_can_use_caselets(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context("intent_discovery")
    artifact_path = _preprocessing_dir(runtime_config, context) / DEFAULT_PREPROCESSED_ARTIFACT
    artifact_path.parent.mkdir(parents=True)
    artifact_path.write_text(
        json.dumps(
            {
                "conversations": [_preprocessed_payload("conversation", [0.0] * FLOW_SIGNATURE_DIM)],
                "issueCaselets": [
                    {
                        "caseletId": "conversation#issue-01",
                        "conversationId": "conversation",
                        "datasetId": "ds1",
                        "turnStart": 0,
                        "turnEnd": 1,
                        "customerIssueText": "환불 문의",
                        "canonicalText": "환불 문의 처리",
                        "flowSignature": [1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 1),
                        "flowSignatureDim": FLOW_SIGNATURE_DIM,
                        "flowEvents": ["확인질문"],
                        "outcome": "resolved",
                        "workflowSignal": {"requires_payment_check": True},
                        "piiMaskCount": 0,
                        "filtered": False,
                        "sourceQualityFlags": [],
                        "qualityScore": 1.0,
                        "qualityTier": "A",
                        "evidenceTurnIds": ["t0", "t1"],
                        "actionObjectFrame": {
                            "object": "결제",
                            "action": "환불",
                            "confidence": 0.9,
                        },
                    },
                    {
                        "caseletId": "conversation#issue-02",
                        "conversationId": "conversation",
                        "datasetId": "ds1",
                        "turnStart": 2,
                        "turnEnd": 3,
                        "customerIssueText": "네",
                        "canonicalText": "네 감사합니다",
                        "flowSignature": [0.0, 1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 2),
                        "flowSignatureDim": FLOW_SIGNATURE_DIM,
                        "flowEvents": ["해결"],
                        "outcome": "resolved",
                        "workflowSignal": {},
                        "piiMaskCount": 0,
                        "filtered": True,
                        "sourceQualityFlags": ["low_information_customer_issue"],
                        "qualityScore": 0.0,
                        "qualityTier": "D",
                    },
                ],
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("PIPELINE_ANALYSIS_UNIT", "caselet")

    conversations, flow_signatures = read_preprocessed_artifact(runtime_config, context)

    assert [conversation.id for conversation in conversations] == ["conversation#issue-01"]
    assert conversations[0].metadata["sourceConversationId"] == "conversation"
    assert conversations[0].metadata["sourceQualityFlags"] == ()
    assert conversations[0].metadata["qualityScore"] == 1.0
    assert conversations[0].metadata["qualityTier"] == "A"
    assert conversations[0].metadata["evidenceTurnIds"] == ("t0", "t1")
    assert conversations[0].metadata["actionObjectFrame"] == {
        "object": "결제",
        "action": "환불",
        "confidence": 0.9,
    }
    assert conversations[0].customer_problem_text == "환불 문의"
    assert flow_signatures.shape == (1, FLOW_SIGNATURE_DIM)


def test_read_preprocessed_artifact_does_not_fallback_when_all_caselets_filtered(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context("intent_discovery")
    artifact_path = _preprocessing_dir(runtime_config, context) / DEFAULT_PREPROCESSED_ARTIFACT
    artifact_path.parent.mkdir(parents=True)
    artifact_path.write_text(
        json.dumps(
            {
                "conversations": [_preprocessed_payload("conversation", [1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 1))],
                "issueCaselets": [
                    {
                        "caseletId": "conversation#issue-01",
                        "conversationId": "conversation",
                        "datasetId": "ds1",
                        "turnStart": 0,
                        "turnEnd": 1,
                        "customerIssueText": "네",
                        "canonicalText": "네 감사합니다",
                        "flowSignature": [0.0] * FLOW_SIGNATURE_DIM,
                        "flowSignatureDim": FLOW_SIGNATURE_DIM,
                        "piiMaskCount": 0,
                        "filtered": True,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("PIPELINE_ANALYSIS_UNIT", "caselet")

    conversations, flow_signatures = read_preprocessed_artifact(runtime_config, context)

    assert conversations == []
    assert flow_signatures.shape == (0, FLOW_SIGNATURE_DIM)


def test_should_raise_when_field_is_not_string(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context("intent_discovery")
    artifact_path = _preprocessing_dir(runtime_config, context) / DEFAULT_PREPROCESSED_ARTIFACT
    artifact_path.parent.mkdir(parents=True)
    _ = artifact_path.write_text(
        json.dumps(
            {
                "conversations": [
                    {
                        "id": 123,
                        "dataset_id": "ds1",
                        "canonical_text": "test",
                        "customer_problem_text": "problem",
                        "flow_signature": [0.0] * FLOW_SIGNATURE_DIM,
                        "flow_signature_dim": FLOW_SIGNATURE_DIM,
                        "turn_count": 1,
                        "customer_turn_count": 1,
                        "pii_mask_count": 0,
                        "filtered": False,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(PipelineStageError, match="field 'id' must be a string"):
        _ = read_preprocessed_artifact(runtime_config, context)


def test_should_raise_when_field_is_not_integer(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context("intent_discovery")
    artifact_path = _preprocessing_dir(runtime_config, context) / DEFAULT_PREPROCESSED_ARTIFACT
    artifact_path.parent.mkdir(parents=True)
    _ = artifact_path.write_text(
        json.dumps(
            {
                "conversations": [
                    {
                        "id": "c1",
                        "dataset_id": "ds1",
                        "canonical_text": "test",
                        "customer_problem_text": "problem",
                        "flow_signature": [0.0] * FLOW_SIGNATURE_DIM,
                        "flow_signature_dim": "invalid",
                        "turn_count": 1,
                        "customer_turn_count": 1,
                        "pii_mask_count": 0,
                        "filtered": False,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(PipelineStageError, match="field 'flow_signature_dim' must be an integer"):
        _ = read_preprocessed_artifact(runtime_config, context)


def test_should_raise_when_field_is_not_boolean(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context("intent_discovery")
    artifact_path = _preprocessing_dir(runtime_config, context) / DEFAULT_PREPROCESSED_ARTIFACT
    artifact_path.parent.mkdir(parents=True)
    _ = artifact_path.write_text(
        json.dumps(
            {
                "conversations": [
                    {
                        "id": "c1",
                        "dataset_id": "ds1",
                        "canonical_text": "test",
                        "customer_problem_text": "problem",
                        "flow_signature": [0.0] * FLOW_SIGNATURE_DIM,
                        "flow_signature_dim": FLOW_SIGNATURE_DIM,
                        "turn_count": 1,
                        "customer_turn_count": 1,
                        "pii_mask_count": 0,
                        "filtered": "true",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(PipelineStageError, match="field 'filtered' must be a boolean"):
        _ = read_preprocessed_artifact(runtime_config, context)


def test_should_raise_when_flow_signature_contains_non_number(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context("intent_discovery")
    artifact_path = _preprocessing_dir(runtime_config, context) / DEFAULT_PREPROCESSED_ARTIFACT
    artifact_path.parent.mkdir(parents=True)
    _ = artifact_path.write_text(
        json.dumps(
            {
                "conversations": [
                    {
                        "id": "c1",
                        "dataset_id": "ds1",
                        "canonical_text": "test",
                        "customer_problem_text": "problem",
                        "flow_signature": [0.0, "invalid", 0.0],
                        "flow_signature_dim": FLOW_SIGNATURE_DIM,
                        "turn_count": 1,
                        "customer_turn_count": 1,
                        "pii_mask_count": 0,
                        "filtered": False,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(PipelineStageError, match="flow_signature must contain only numbers"):
        _ = read_preprocessed_artifact(runtime_config, context)


def test_should_raise_when_optional_field_has_invalid_type(tmp_path: Path) -> None:
    runtime_config = _runtime_config(tmp_path)
    context = _context("intent_discovery")
    artifact_path = _preprocessing_dir(runtime_config, context) / DEFAULT_PREPROCESSED_ARTIFACT
    artifact_path.parent.mkdir(parents=True)
    _ = artifact_path.write_text(
        json.dumps(
            {
                "conversations": [
                    {
                        "id": "c1",
                        "dataset_id": "ds1",
                        "canonical_text": "test",
                        "customer_problem_text": "problem",
                        "flow_signature": [0.0] * FLOW_SIGNATURE_DIM,
                        "flow_signature_dim": FLOW_SIGNATURE_DIM,
                        "turn_count": 1,
                        "customer_turn_count": 1,
                        "pii_mask_count": 0,
                        "filtered": False,
                        "channel": 123,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(PipelineStageError, match="Optional field must be a string or null"):
        _ = read_preprocessed_artifact(runtime_config, context)


def _is_ndarray(value: object) -> TypeGuard[np.ndarray]:
    return isinstance(value, np.ndarray)
