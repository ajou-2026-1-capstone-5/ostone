"""Unit tests for draft_generation workflow_graph module.

Covers: signal_based_generator (8 signal combinations), V1~V8 graph validation,
serialize_graph_json, and graph structure assertions.
"""

from __future__ import annotations

import json
import re
from collections import deque

from pipeline.stages.draft_generation.workflow_graph import (
    ClusterContext,
    GraphEdgeSpec,
    GraphNodeSpec,
    WorkflowGraphSpec,
    _add_start_edges_to_unreachable_nodes,
    _event_node,
    frequent_path_generator,
    graph_event_specificity,
    serialize_graph_json,
    signal_based_generator,
)

# ---------------------------------------------------------------------------
# V1~V8 graph validation helper
# ---------------------------------------------------------------------------


def _validate_graph(spec: WorkflowGraphSpec, policy_codes: set[str] | None = None) -> None:
    """Raises AssertionError if spec violates any of V1~V8."""
    if policy_codes is None:
        policy_codes = {"default_policy"}

    node_ids = {n.id for n in spec.nodes}
    start_nodes = [n for n in spec.nodes if n.type == "START"]
    terminal_nodes = [n for n in spec.nodes if n.type == "TERMINAL"]

    # V1: exactly 1 START
    assert len(start_nodes) == 1, f"V1 violation: {len(start_nodes)} START nodes"

    # V2: ≥1 TERMINAL
    assert len(terminal_nodes) >= 1, "V2 violation: no TERMINAL node"

    # V3: no dangling edges
    for edge in spec.edges:
        assert edge.from_node in node_ids, f"V3 violation: from_node '{edge.from_node}' not in nodes"
        assert edge.to_node in node_ids, f"V3 violation: to_node '{edge.to_node}' not in nodes"

    # V4: all nodes reachable from START via BFS
    adjacency: dict[str, list[str]] = {n.id: [] for n in spec.nodes}
    for edge in spec.edges:
        adjacency[edge.from_node].append(edge.to_node)

    visited: set[str] = set()
    queue: deque[str] = deque([start_nodes[0].id])
    while queue:
        current = queue.popleft()
        if current in visited:
            continue
        visited.add(current)
        for neighbor in adjacency[current]:
            queue.append(neighbor)
    unreachable = node_ids - visited
    assert not unreachable, f"V4 violation: unreachable nodes {unreachable}"

    # V5: no cycle (DFS-based)
    def _has_cycle(node: str, visiting: set[str], visited_set: set[str]) -> bool:
        visiting.add(node)
        for neighbor in adjacency[node]:
            if neighbor in visiting:
                return True
            if neighbor not in visited_set and _has_cycle(neighbor, visiting, visited_set):
                return True
        visiting.discard(node)
        visited_set.add(node)
        return False

    visited_dfs: set[str] = set()
    for node_id in node_ids:
        if node_id not in visited_dfs:
            assert not _has_cycle(node_id, set(), visited_dfs), "V5 violation: cycle detected"

    # V6: DECISION outgoing edges must have labels
    decision_ids = {n.id for n in spec.nodes if n.type == "DECISION"}
    for edge in spec.edges:
        if edge.from_node in decision_ids:
            assert edge.label, f"V6 violation: DECISION edge {edge.id} missing label"

    # V7a: all edges have non-blank id
    for edge in spec.edges:
        assert edge.id and edge.id.strip(), "V7a violation: edge missing id"

    # V7b: edge ids unique within workflow
    edge_ids = [edge.id for edge in spec.edges]
    assert len(edge_ids) == len(set(edge_ids)), f"V7b violation: duplicate edge ids {edge_ids}"

    # V7c: edge id pattern [A-Za-z0-9_-]+
    pattern = re.compile(r"^[A-Za-z0-9_\-]+$")
    for edge in spec.edges:
        assert pattern.match(edge.id), f"V7c violation: invalid edge id '{edge.id}'"

    # V8a: ACTION nodes must have policyRef
    for node in spec.nodes:
        if node.type == "ACTION":
            assert node.policy_ref is not None, f"V8a violation: ACTION node '{node.id}' missing policyRef"

    # V8b: policyRef valid chars (non-blank, no spaces)
    for node in spec.nodes:
        if node.policy_ref is not None:
            assert node.policy_ref.strip(), f"V8b violation: blank policyRef on '{node.id}'"

    # V8c: policyRef ∈ policy_codes
    for node in spec.nodes:
        if node.policy_ref is not None:
            assert node.policy_ref in policy_codes, (
                f"V8c violation: policyRef '{node.policy_ref}' not in {policy_codes}"
            )


def _make_context(
    cluster_id: int = 0,
    suggested_name: str = "테스트",
    *,
    identify: bool = False,
    payment: bool = False,
    escalation: bool = False,
) -> ClusterContext:
    return ClusterContext(
        cluster_id=cluster_id,
        suggested_name=suggested_name,
        workflow_signal={
            "requires_user_identification": identify,
            "requires_payment_check": payment,
            "has_escalation_cases": escalation,
        },
    )


# ---------------------------------------------------------------------------
# Baseline (all signals false)
# ---------------------------------------------------------------------------


def test_baseline_node_edge_count() -> None:
    spec = signal_based_generator(_make_context())
    assert len(spec.nodes) == 3
    assert len(spec.edges) == 2


def test_baseline_node_types() -> None:
    spec = signal_based_generator(_make_context())
    types = [n.type for n in spec.nodes]
    assert types.count("START") == 1
    assert types.count("ACTION") == 1
    assert types.count("TERMINAL") == 1


def test_baseline_direction_is_lr() -> None:
    spec = signal_based_generator(_make_context())
    assert spec.direction == "LR"


def test_baseline_start_label() -> None:
    spec = signal_based_generator(_make_context())
    start = next(n for n in spec.nodes if n.type == "START")
    assert start.label == "시작"


def test_baseline_terminal_label() -> None:
    spec = signal_based_generator(_make_context())
    terminal = next(n for n in spec.nodes if n.type == "TERMINAL")
    assert terminal.label == "종료"


def test_baseline_action_label_uses_suggested_name() -> None:
    spec = signal_based_generator(_make_context(suggested_name="환불 문의"))
    action = next(n for n in spec.nodes if n.type == "ACTION")
    assert action.label == "환불 문의"


def test_baseline_passes_v1_to_v8() -> None:
    spec = signal_based_generator(_make_context())
    _validate_graph(spec)


def test_graph_event_specificity_uses_domain_specific_graph_nodes() -> None:
    generic_spec = WorkflowGraphSpec(
        direction="LR",
        nodes=(
            GraphNodeSpec("start", "START", "시작"),
            GraphNodeSpec("request_check", "ACTION", "요청 내용 확인", "default_policy"),
            GraphNodeSpec("terminal", "TERMINAL", "종료"),
        ),
        edges=(
            GraphEdgeSpec("e1", "start", "request_check"),
            GraphEdgeSpec("e2", "request_check", "terminal"),
        ),
    )
    specific_spec = WorkflowGraphSpec(
        direction="LR",
        nodes=(
            GraphNodeSpec("start", "START", "시작"),
            GraphNodeSpec(
                "route_check",
                "DECISION",
                "진입 조건 확인",
                evidence_refs=({"type": "route_term", "value": "요금제"},),
            ),
            GraphNodeSpec("request_check", "ACTION", "요청 내용 확인", "default_policy"),
            GraphNodeSpec("policy_control", "ACTION", "정책 확인: 요금제 변경 기준", "default_policy"),
            GraphNodeSpec("terminal", "TERMINAL", "종료"),
        ),
        edges=(
            GraphEdgeSpec("e1", "start", "route_check"),
            GraphEdgeSpec("e2", "route_check", "request_check", "matched"),
            GraphEdgeSpec("e3", "request_check", "policy_control"),
            GraphEdgeSpec("e4", "policy_control", "terminal"),
        ),
    )
    path_cases = [(["확인질문", "확인질문", "해결"], "resolved")]

    assert graph_event_specificity(path_cases, specific_spec) > graph_event_specificity(path_cases, generic_spec)


def test_baseline_edge_ids_sequential() -> None:
    spec = signal_based_generator(_make_context(cluster_id=3))
    assert spec.edges[0].id == "e_3_1"
    assert spec.edges[1].id == "e_3_2"


# ---------------------------------------------------------------------------
# requires_user_identification only
# ---------------------------------------------------------------------------


def test_identify_only_node_edge_count() -> None:
    spec = signal_based_generator(_make_context(identify=True))
    assert len(spec.nodes) == 4
    assert len(spec.edges) == 3


def test_identify_only_has_identify_action() -> None:
    spec = signal_based_generator(_make_context(identify=True))
    action_ids = [n.id for n in spec.nodes if n.type == "ACTION"]
    assert "identify" in action_ids


def test_identify_only_identify_label() -> None:
    spec = signal_based_generator(_make_context(identify=True))
    identify_node = next(n for n in spec.nodes if n.id == "identify")
    assert identify_node.label == "본인인증"


def test_identify_only_topology() -> None:
    spec = signal_based_generator(_make_context(identify=True))
    edge_pairs = [(e.from_node, e.to_node) for e in spec.edges]
    assert ("start", "identify") in edge_pairs
    assert ("identify", "action") in edge_pairs
    assert ("action", "terminal") in edge_pairs


def test_identify_only_passes_v1_to_v8() -> None:
    spec = signal_based_generator(_make_context(identify=True))
    _validate_graph(spec)


# ---------------------------------------------------------------------------
# requires_payment_check only
# ---------------------------------------------------------------------------


def test_payment_only_node_edge_count() -> None:
    spec = signal_based_generator(_make_context(payment=True))
    assert len(spec.nodes) == 4
    assert len(spec.edges) == 3


def test_payment_only_has_payment_check_action() -> None:
    spec = signal_based_generator(_make_context(payment=True))
    action_ids = [n.id for n in spec.nodes if n.type == "ACTION"]
    assert "payment_check" in action_ids


def test_payment_only_payment_check_label() -> None:
    spec = signal_based_generator(_make_context(payment=True))
    node = next(n for n in spec.nodes if n.id == "payment_check")
    assert node.label == "결제 확인"


def test_payment_only_topology() -> None:
    spec = signal_based_generator(_make_context(payment=True))
    edge_pairs = [(e.from_node, e.to_node) for e in spec.edges]
    assert ("start", "payment_check") in edge_pairs
    assert ("payment_check", "action") in edge_pairs
    assert ("action", "terminal") in edge_pairs


def test_payment_only_passes_v1_to_v8() -> None:
    spec = signal_based_generator(_make_context(payment=True))
    _validate_graph(spec)


# ---------------------------------------------------------------------------
# has_escalation_cases only
# ---------------------------------------------------------------------------


def test_escalation_only_node_edge_count() -> None:
    spec = signal_based_generator(_make_context(escalation=True))
    assert len(spec.nodes) == 6
    assert len(spec.edges) == 5


def test_escalation_only_has_decision_and_handoff() -> None:
    spec = signal_based_generator(_make_context(escalation=True))
    types = {n.type for n in spec.nodes}
    assert "DECISION" in types
    assert "HANDOFF" in types


def test_escalation_only_decision_label() -> None:
    spec = signal_based_generator(_make_context(escalation=True))
    decision = next(n for n in spec.nodes if n.type == "DECISION")
    assert decision.label == "분기"


def test_escalation_only_handoff_label() -> None:
    spec = signal_based_generator(_make_context(escalation=True))
    handoff = next(n for n in spec.nodes if n.type == "HANDOFF")
    assert handoff.label == "상담원 연결"


def test_escalation_only_two_terminals() -> None:
    spec = signal_based_generator(_make_context(escalation=True))
    terminals = [n for n in spec.nodes if n.type == "TERMINAL"]
    assert len(terminals) == 2


def test_escalation_only_decision_edges_have_labels() -> None:
    spec = signal_based_generator(_make_context(escalation=True))
    decision_id = next(n.id for n in spec.nodes if n.type == "DECISION")
    decision_edges = [e for e in spec.edges if e.from_node == decision_id]
    assert len(decision_edges) == 2
    labels = {e.label for e in decision_edges}
    assert "resolved" in labels
    assert "escalated" in labels


def test_escalation_only_passes_v1_to_v8() -> None:
    spec = signal_based_generator(_make_context(escalation=True))
    _validate_graph(spec)


# ---------------------------------------------------------------------------
# identify + payment (no escalation)
# ---------------------------------------------------------------------------


def test_identify_payment_node_edge_count() -> None:
    spec = signal_based_generator(_make_context(identify=True, payment=True))
    assert len(spec.nodes) == 5
    assert len(spec.edges) == 4


def test_identify_payment_topology() -> None:
    spec = signal_based_generator(_make_context(identify=True, payment=True))
    edge_pairs = [(e.from_node, e.to_node) for e in spec.edges]
    assert ("start", "identify") in edge_pairs
    assert ("identify", "payment_check") in edge_pairs
    assert ("payment_check", "action") in edge_pairs
    assert ("action", "terminal") in edge_pairs


def test_identify_payment_passes_v1_to_v8() -> None:
    spec = signal_based_generator(_make_context(identify=True, payment=True))
    _validate_graph(spec)


# ---------------------------------------------------------------------------
# identify + escalation (no payment)
# ---------------------------------------------------------------------------


def test_identify_escalation_passes_v1_to_v8() -> None:
    spec = signal_based_generator(_make_context(identify=True, escalation=True))
    _validate_graph(spec)


def test_identify_escalation_node_count() -> None:
    spec = signal_based_generator(_make_context(identify=True, escalation=True))
    assert len(spec.nodes) == 7


# ---------------------------------------------------------------------------
# payment + escalation (no identify)
# ---------------------------------------------------------------------------


def test_payment_escalation_passes_v1_to_v8() -> None:
    spec = signal_based_generator(_make_context(payment=True, escalation=True))
    _validate_graph(spec)


def test_payment_escalation_topology() -> None:
    spec = signal_based_generator(_make_context(payment=True, escalation=True))
    edge_pairs = [(e.from_node, e.to_node) for e in spec.edges]
    assert ("start", "payment_check") in edge_pairs
    assert ("payment_check", "action") in edge_pairs
    assert ("action", "decision") in edge_pairs


# ---------------------------------------------------------------------------
# All 3 signals true
# ---------------------------------------------------------------------------


def test_all_signals_node_count() -> None:
    spec = signal_based_generator(_make_context(identify=True, payment=True, escalation=True))
    assert len(spec.nodes) == 8


def test_all_signals_topology() -> None:
    spec = signal_based_generator(_make_context(identify=True, payment=True, escalation=True))
    edge_pairs = [(e.from_node, e.to_node) for e in spec.edges]
    assert ("start", "identify") in edge_pairs
    assert ("identify", "payment_check") in edge_pairs
    assert ("payment_check", "action") in edge_pairs
    assert ("action", "decision") in edge_pairs


def test_all_signals_passes_v1_to_v8() -> None:
    spec = signal_based_generator(_make_context(identify=True, payment=True, escalation=True))
    _validate_graph(spec)


# ---------------------------------------------------------------------------
# Edge-case inputs
# ---------------------------------------------------------------------------


def test_missing_workflow_signal_falls_back_to_baseline() -> None:
    ctx = ClusterContext(cluster_id=0, suggested_name="테스트", workflow_signal={})
    spec = signal_based_generator(ctx)
    assert len(spec.nodes) == 3
    assert len(spec.edges) == 2


def test_suggested_name_fallback_used_in_action_label() -> None:
    ctx = ClusterContext(cluster_id=5, suggested_name="주문 취소", workflow_signal={})
    spec = signal_based_generator(ctx)
    action = next(n for n in spec.nodes if n.id == "action")
    assert action.label == "주문 취소"


def test_observed_workflow_events_add_grounded_action_nodes() -> None:
    ctx = ClusterContext(
        cluster_id=9,
        suggested_name="처리 문의",
        workflow_signal={"has_escalation_cases": False},
        workflow_events=("확인질문", "추가정보요청", "정책안내"),
    )

    spec = signal_based_generator(ctx)
    node_ids = [node.id for node in spec.nodes]

    assert "request_check" in node_ids
    assert "info_collect" in node_ids
    assert "policy_check" in node_ids
    _validate_graph(spec)
    serialized = json.loads(serialize_graph_json(spec))
    request_check = next(node for node in serialized["nodes"] if node["id"] == "request_check")
    assert request_check["evidenceRefs"] == [{"type": "flow_event", "value": "확인질문"}]


def test_event_node_maps_supported_flow_events() -> None:
    expected = {
        "확인질문": "request_check",
        "추가정보요청": "info_collect",
        "정책안내": "policy_check",
        "불만표현": "issue_review",
        "예외처리": "exception_review",
        "해결": "result_notice",
    }

    for event, node_id in expected.items():
        node = _event_node(event, "policy_1")
        assert node is not None
        assert node.id == node_id
        assert node.policy_ref == "policy_1"
        assert node.evidence_refs == ({"type": "flow_event", "value": event},)
    assert _event_node("이관", "policy_1") is None


# ---------------------------------------------------------------------------
# serialize_graph_json
# ---------------------------------------------------------------------------


def test_serialize_includes_direction() -> None:
    spec = signal_based_generator(_make_context())
    result = json.loads(serialize_graph_json(spec))
    assert result["direction"] == "LR"


def test_serialize_all_nodes_have_label() -> None:
    spec = signal_based_generator(_make_context(identify=True, payment=True, escalation=True))
    result = json.loads(serialize_graph_json(spec))
    for node in result["nodes"]:
        assert "label" in node, f"node {node['id']} missing label"


def test_serialize_action_nodes_have_policy_ref() -> None:
    spec = signal_based_generator(_make_context())
    result = json.loads(serialize_graph_json(spec))
    action_nodes = [n for n in result["nodes"] if n["type"] == "ACTION"]
    for node in action_nodes:
        assert "policyRef" in node, f"ACTION node {node['id']} missing policyRef"


def test_serialize_non_action_nodes_no_policy_ref() -> None:
    spec = signal_based_generator(_make_context())
    result = json.loads(serialize_graph_json(spec))
    non_action = [n for n in result["nodes"] if n["type"] != "ACTION"]
    for node in non_action:
        assert "policyRef" not in node, f"non-ACTION node {node['id']} should not have policyRef"


def test_serialize_edge_from_to_keys() -> None:
    spec = signal_based_generator(_make_context())
    result = json.loads(serialize_graph_json(spec))
    for edge in result["edges"]:
        assert "from" in edge
        assert "to" in edge
        assert "id" in edge


def test_serialize_decision_edges_have_labels() -> None:
    spec = signal_based_generator(_make_context(escalation=True))
    result = json.loads(serialize_graph_json(spec))
    decision_id = next(n["id"] for n in result["nodes"] if n["type"] == "DECISION")
    decision_edges = [e for e in result["edges"] if e["from"] == decision_id]
    for edge in decision_edges:
        assert "label" in edge, f"DECISION outgoing edge {edge['id']} missing label"


def test_serialize_length_within_20000() -> None:
    spec = signal_based_generator(_make_context(identify=True, payment=True, escalation=True))
    serialized = serialize_graph_json(spec)
    assert len(serialized) <= 20000


def test_frequent_path_generator_mines_supported_edges() -> None:
    context = ClusterContext(cluster_id=7, suggested_name="처리 문의", workflow_signal={}, policy_ref="policy_1")

    spec = frequent_path_generator(
        context,
        [
            (["확인질문", "정책안내", "해결"], "resolved"),
            (["확인질문", "정책안내", "해결"], "resolved"),
            (["확인질문", "추가정보요청", "정책안내", "해결"], "resolved"),
        ],
        min_edge_support=0.34,
    )
    result = json.loads(serialize_graph_json(spec))

    assert any(node["id"] == "request_check" and node["support"] == 1.0 for node in result["nodes"])
    assert any(edge["from"] == "request_check" and edge["to"] == "policy_check" for edge in result["edges"])
    assert any(edge.get("label") == "resolved" for edge in result["edges"])


def test_frequent_path_generator_repairs_supported_unreachable_nodes() -> None:
    context = ClusterContext(cluster_id=9, suggested_name="처리 문의", workflow_signal={}, policy_ref="policy_1")
    edges = [GraphEdgeSpec("e_9_1", "issue_review", "request_check", "observed", 0.5)]

    next_edge = _add_start_edges_to_unreachable_nodes(
        context,
        edges,
        {"START", "불만표현", "확인질문"},
        2,
    )

    assert next_edge == 3
    assert any(edge.from_node == "start" and edge.to_node == "issue_review" for edge in edges)


def test_frequent_path_generator_falls_back_when_no_terminal_path() -> None:
    context = ClusterContext(cluster_id=8, suggested_name="처리 문의", workflow_signal={}, policy_ref="policy_1")

    spec = frequent_path_generator(context, [], min_edge_support=0.5)

    result = json.loads(serialize_graph_json(spec))
    assert any(node["id"] == "action" for node in result["nodes"])
