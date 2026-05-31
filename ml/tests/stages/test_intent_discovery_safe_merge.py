from __future__ import annotations

import numpy as np

from pipeline.stages.intent_discovery.safe_merge import safe_merge_microclusters
from pipeline.stages.preprocessing.types import FLOW_SIGNATURE_DIM, ProcessedConversation


def test_safe_merge_merges_compatible_microclusters_only() -> None:
    conversations = [
        _conversation("c1", "요금 확인", "요금", "확인", {"requires_payment_check": True}),
        _conversation("c2", "요금 조회", "요금", "확인", {"requires_payment_check": True}),
        _conversation("c3", "요금 내역 확인", "요금", "확인", {"requires_payment_check": True}),
        _conversation("c4", "요금 확인 부탁", "요금", "확인", {"requires_payment_check": True}),
        _conversation("c5", "카드 해지", "카드", "해지", {}),
        _conversation("c6", "카드 탈퇴", "카드", "해지", {}),
    ]
    vectors = np.asarray(
        [
            [1.0, 0.0, 0.0],
            [0.98, 0.02, 0.0],
            [0.97, 0.03, 0.0],
            [0.96, 0.04, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.98, 0.02],
        ],
        dtype=np.float32,
    )
    flow = np.asarray([[1.0] + [0.0] * (FLOW_SIGNATURE_DIM - 1)] * 6, dtype=np.float32)

    merged, report = safe_merge_microclusters(
        {1: [0, 1], 2: [2, 3], 3: [4, 5]},
        conversations,
        vectors,
        flow,
        min_merge_score=0.80,
    )

    assert len(merged) == 2
    assert report["safeMergeMergedClusterCount"] == 1
    assert report["safeMergeBlockedConflictCount"] >= 1
    assert sorted(len(members) for members in merged.values()) == [2, 4]


def _conversation(
    conversation_id: str,
    text: str,
    object_term: str,
    action: str,
    signal: dict[str, bool],
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
        workflow_signal=signal,
        metadata={"actionObjectFrame": {"object": object_term, "action": action}},
    )
