from __future__ import annotations

from pipeline.stages.draft_generation.main import _build_structure_snapshot


def test_structure_snapshot_groups_workflows_under_source_intent() -> None:
    clusters = [
        {
            "cluster_id": 10,
            "source_cluster_id": 0,
            "workflow_entrypoint_id": "entrypoint-10",
            "suggested_name": "카드 분실 신고",
            "canonical_intent": "카드",
            "member_conv_ids": ["c1", "c2"],
        },
        {
            "cluster_id": 11,
            "source_cluster_id": 0,
            "workflow_entrypoint_id": "entrypoint-11",
            "suggested_name": "카드 한도 문의",
            "canonical_intent": "카드",
            "member_conv_ids": ["c3"],
        },
    ]
    snapshot = _build_structure_snapshot({"flow_split_metrics": {}}, clusters)

    assert snapshot["schemaVersion"] == "structure-snapshot.v1"
    assert len(snapshot["workflows"]) == 2
    assert len(snapshot["intents"]) == 1
    intent = snapshot["intents"][0]
    assert intent["intentId"] == "0"
    assert intent["intentLabel"] == "카드"
    assert sorted(intent["memberConversationIds"]) == ["c1", "c2", "c3"]


def test_structure_snapshot_copies_workflow_feedback() -> None:
    workflow_feedback = {
        "applied": [{"sourceId": "c1", "targetId": "c2", "type": "same_workflow", "effect": "merged"}],
        "ignored": [],
    }
    clusters = [
        {
            "cluster_id": 1,
            "source_cluster_id": 0,
            "workflow_entrypoint_id": "entrypoint-1",
            "suggested_name": "통합",
            "member_conv_ids": ["c1", "c2"],
        }
    ]
    snapshot = _build_structure_snapshot({"flow_split_metrics": {"workflowFeedback": workflow_feedback}}, clusters)
    assert snapshot["workflowFeedback"] == workflow_feedback


def test_structure_snapshot_defaults_when_flow_metrics_missing() -> None:
    snapshot = _build_structure_snapshot({}, [])
    assert snapshot["intents"] == []
    assert snapshot["workflows"] == []
    assert snapshot["workflowFeedback"] == {"applied": [], "ignored": []}


def test_structure_snapshot_does_not_collapse_id_less_clusters() -> None:
    clusters = [
        {"suggested_name": "A", "member_conv_ids": ["c1"]},
        {"suggested_name": "B", "member_conv_ids": ["c2"]},
    ]
    snapshot = _build_structure_snapshot({}, clusters)
    intent_ids = {intent["intentId"] for intent in snapshot["intents"]}
    # id가 없는 두 클러스터가 하나의 intent("")로 합쳐지면 안 된다.
    assert len(intent_ids) == 2
