from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from pipeline.stages.intent_discovery.feedback_constraints import (
    FeedbackConstraint,
    load_feedback_constraints,
)
from pipeline.stages.intent_discovery.same_intent_graph import build_same_intent_probability_graph
from pipeline.stages.preprocessing.types import FLOW_SIGNATURE_DIM, ProcessedConversation


def test_same_intent_probability_graph_uses_frame_conflicts_and_feedback(tmp_path: Path) -> None:
    conversations = [
        _conversation("c1", "요금 확인", "요금", "확인"),
        _conversation("c2", "요금 조회", "요금", "확인"),
        _conversation("c3", "카드 해지", "카드", "해지"),
    ]
    vectors = np.asarray([[1.0, 0.0], [0.96, 0.04], [0.95, 0.05]], dtype=np.float32)
    flow = np.asarray(
        [
            [1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 1),
            [1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 1),
            [0.0, 1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 2),
        ],
        dtype=np.float32,
    )

    graph, report = build_same_intent_probability_graph(
        conversations,
        vectors,
        flow,
        k=2,
        constraints=[FeedbackConstraint("c1", "c3", "cannot_link")],
    )

    edges = {tuple(sorted(edge.tuple)) for edge in graph.es}
    assert (0, 1) in edges
    assert (0, 2) not in edges
    assert report["conflictPairCount"] >= 1
    assert report["cannotLinkSkippedCount"] == 1
    assert report["ambiguousPairCount"] >= 0
    assert report["edgeHubnessMaxDegree"] >= 1
    assert report["edgeHubnessMeanDegree"] >= 1.0

    path = tmp_path / "constraints.json"
    path.write_text(
        json.dumps({"constraints": [{"sourceCaseletId": "c1", "targetCaseletId": "c2", "type": "must_link"}]}),
        encoding="utf-8",
    )
    assert load_feedback_constraints(path) == [FeedbackConstraint("c1", "c2", "must_link", 1.0)]


def test_same_intent_probability_graph_forces_must_link_edge() -> None:
    conversations = [
        _conversation("left", "요금 확인", "요금", "확인"),
        _conversation("right", "카드 해지", "카드", "해지"),
    ]
    vectors = np.asarray([[1.0, 0.0], [0.0, 1.0]], dtype=np.float32)
    flow = np.zeros((2, FLOW_SIGNATURE_DIM), dtype=np.float32)

    graph, report = build_same_intent_probability_graph(
        conversations,
        vectors,
        flow,
        k=1,
        constraints=[FeedbackConstraint("left", "right", "must_link", 1.0)],
    )

    assert graph.ecount() == 1
    assert report["mustLinkEdgeCount"] == 1


def test_same_intent_probability_graph_treats_same_action_object_mismatch_as_soft_signal() -> None:
    conversations = [
        _conversation("left", "요금 확인", "요금", "확인"),
        _conversation("right", "청구서 확인", "청구서", "확인"),
    ]
    vectors = np.asarray([[1.0, 0.0], [0.98, 0.02]], dtype=np.float32)
    flow = np.asarray(
        [
            [1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 1),
            [1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 1),
        ],
        dtype=np.float32,
    )

    graph, report = build_same_intent_probability_graph(conversations, vectors, flow, k=1)

    assert graph.ecount() == 1
    assert report["conflictPairCount"] == 0


def test_same_intent_probability_graph_blocks_same_action_different_object_scope() -> None:
    conversations = [
        _conversation("left", "여행상품 결제 문의", "여행상품", "결제"),
        _conversation("right", "카드대금 결제 문의", "카드대금", "결제"),
    ]
    vectors = np.asarray([[1.0, 0.0], [0.8, 0.6]], dtype=np.float32)
    flow = np.asarray(
        [
            [1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 1),
            [1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 1),
        ],
        dtype=np.float32,
    )

    graph, report = build_same_intent_probability_graph(conversations, vectors, flow, k=1)

    assert graph.ecount() == 0
    assert report["conflictPairCount"] == 1


def test_same_intent_probability_graph_ignores_low_quality_frame_object_conflict() -> None:
    conversations = [
        _conversation("left", "확인 문의", "되는 말고 제가", "확인", object_quality=0.2),
        _conversation("right", "확인 문의", "수고하십니다", "확인", object_quality=0.2),
    ]
    vectors = np.asarray([[1.0, 0.0], [0.98, 0.02]], dtype=np.float32)
    flow = np.asarray(
        [
            [1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 1),
            [1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 1),
        ],
        dtype=np.float32,
    )

    graph, report = build_same_intent_probability_graph(conversations, vectors, flow, k=1)

    assert graph.ecount() == 1
    assert report["conflictPairCount"] == 0


def test_same_intent_probability_graph_tracks_slot_schema_conflict_and_boundary_uncertainty() -> None:
    conversations = [
        _conversation(
            "left",
            "결제 금액 확인",
            "결제 금액",
            "확인",
            workflow_signal={"requires_payment_check": True},
            source_quality_flags=["short_caselet"],
            quality_score=0.65,
        ),
        _conversation(
            "right",
            "결제 금액 확인",
            "결제 금액",
            "확인",
            workflow_signal={"requires_user_identification": True},
        ),
    ]
    vectors = np.asarray([[1.0, 0.0], [0.6, 0.8]], dtype=np.float32)
    flow = np.zeros((2, FLOW_SIGNATURE_DIM), dtype=np.float32)

    graph, report = build_same_intent_probability_graph(conversations, vectors, flow, k=1)

    assert graph.ecount() == 0
    assert report["slotSchemaConflictPairCount"] == 1
    assert report["boundaryUncertainPairCount"] == 1
    assert report["conflictPairCount"] == 1


def _conversation(
    conversation_id: str,
    text: str,
    object_term: str,
    action: str,
    *,
    object_quality: float = 1.0,
    workflow_signal: dict[str, bool] | None = None,
    source_quality_flags: list[str] | None = None,
    quality_score: float = 1.0,
) -> ProcessedConversation:
    return ProcessedConversation(
        id=conversation_id,
        dataset_id="ds",
        ended_status="resolved",
        canonical_text=text,
        customer_problem_text=text,
        flow_signature=tuple([0.0] * FLOW_SIGNATURE_DIM),
        flow_signature_dim=FLOW_SIGNATURE_DIM,
        turn_count=2,
        customer_turn_count=1,
        pii_mask_count=0,
        filtered=False,
        workflow_signal=workflow_signal or {},
        metadata={
            "qualityTier": "A",
            "qualityScore": quality_score,
            "sourceQualityFlags": source_quality_flags or [],
            "actionObjectFrame": {
                "object": object_term,
                "action": action,
                "confidence": 0.9,
                "objectQuality": object_quality,
            },
        },
    )
