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
            exemplar_indices=(0,),
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
            exemplar_indices=(2,),
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
    }


def _read_output(clusters_path: Path) -> OutputArtifact:
    return cast(OutputArtifact, json.loads(clusters_path.read_text(encoding="utf-8")))


def _is_ndarray(value: object) -> TypeGuard[np.ndarray]:
    return isinstance(value, np.ndarray)
