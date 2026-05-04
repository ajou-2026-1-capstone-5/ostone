from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ClusterContext:
    cluster_id: int
    suggested_name: str
    workflow_signal: dict[str, bool]


@dataclass(frozen=True)
class GraphNodeSpec:
    id: str
    type: str
    label: str
    policy_ref: str | None = None


@dataclass(frozen=True)
class GraphEdgeSpec:
    id: str
    from_node: str
    to_node: str
    label: str | None = None


@dataclass(frozen=True)
class WorkflowGraphSpec:
    direction: str
    nodes: tuple[GraphNodeSpec, ...]
    edges: tuple[GraphEdgeSpec, ...]


class WorkflowGraphGenerator(Protocol):
    def __call__(self, context: ClusterContext) -> WorkflowGraphSpec: ...


def signal_based_generator(context: ClusterContext) -> WorkflowGraphSpec:
    cid = context.cluster_id
    signal = context.workflow_signal or {}
    requires_identification = bool(signal.get("requires_user_identification"))
    requires_payment = bool(signal.get("requires_payment_check"))
    has_escalation = bool(signal.get("has_escalation_cases"))

    pre_chain: list[GraphNodeSpec] = [GraphNodeSpec(id="start", type="START", label="시작")]
    if requires_identification:
        pre_chain.append(GraphNodeSpec(id="identify", type="ACTION", label="본인인증", policy_ref="default_policy"))
    if requires_payment:
        pre_chain.append(
            GraphNodeSpec(id="payment_check", type="ACTION", label="결제 확인", policy_ref="default_policy")
        )
    action = GraphNodeSpec(id="action", type="ACTION", label=context.suggested_name, policy_ref="default_policy")
    full_chain = pre_chain + [action]

    all_nodes: list[GraphNodeSpec] = list(full_chain)
    all_edges: list[GraphEdgeSpec] = []
    counter = [1]

    def _next_id() -> str:
        eid = f"e_{cid}_{counter[0]}"
        counter[0] += 1
        return eid

    for cur, nxt in zip(full_chain, full_chain[1:]):
        all_edges.append(GraphEdgeSpec(id=_next_id(), from_node=cur.id, to_node=nxt.id))

    if has_escalation:
        decision = GraphNodeSpec(id="decision", type="DECISION", label="분기")
        terminal = GraphNodeSpec(id="terminal", type="TERMINAL", label="종료")
        handoff = GraphNodeSpec(id="handoff", type="HANDOFF", label="상담원 연결")
        terminal_alt = GraphNodeSpec(id="terminal_alt", type="TERMINAL", label="종료")
        all_nodes.extend([decision, terminal, handoff, terminal_alt])
        all_edges.append(GraphEdgeSpec(id=_next_id(), from_node="action", to_node="decision"))
        all_edges.append(GraphEdgeSpec(id=_next_id(), from_node="decision", to_node="terminal", label="resolved"))
        all_edges.append(GraphEdgeSpec(id=_next_id(), from_node="decision", to_node="handoff", label="escalated"))
        all_edges.append(GraphEdgeSpec(id=_next_id(), from_node="handoff", to_node="terminal_alt"))
    else:
        terminal = GraphNodeSpec(id="terminal", type="TERMINAL", label="종료")
        all_nodes.append(terminal)
        all_edges.append(GraphEdgeSpec(id=_next_id(), from_node="action", to_node="terminal"))

    return WorkflowGraphSpec(direction="LR", nodes=tuple(all_nodes), edges=tuple(all_edges))


def serialize_graph_json(spec: WorkflowGraphSpec) -> str:
    nodes_list: list[dict[str, object]] = []
    for node in spec.nodes:
        node_dict: dict[str, object] = {"id": node.id, "type": node.type, "label": node.label}
        if node.policy_ref is not None:
            node_dict["policyRef"] = node.policy_ref
        nodes_list.append(node_dict)

    edges_list: list[dict[str, object]] = []
    for edge in spec.edges:
        edge_dict: dict[str, object] = {"id": edge.id, "from": edge.from_node, "to": edge.to_node}
        if edge.label is not None:
            edge_dict["label"] = edge.label
        edges_list.append(edge_dict)

    return json.dumps({"direction": spec.direction, "nodes": nodes_list, "edges": edges_list}, ensure_ascii=False)
