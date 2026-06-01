from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

DUMMY_POLICY_CODE = "default_policy"
GENERIC_EVENT_TOKENS = frozenset({"확인질문", "추가정보요청", "해결"})
GENERIC_NODE_LABELS = frozenset(
    {
        "시작",
        "종료",
        "상담원 이관 종료",
        "본인인증",
        "결제 확인",
        "요청 내용 확인",
        "필요 정보 수집",
        "처리 기준 확인",
        "문제 상황 확인",
        "예외 처리 검토",
        "처리 결과 안내",
        "진입 조건 확인",
        "분기",
        "상담원 연결",
    }
)
GENERIC_LABEL_TERMS = frozenset(
    {
        "문의",
        "요청",
        "확인",
        "정보",
        "수집",
        "처리",
        "기준",
        "정책",
        "위험",
        "슬롯",
        "진입",
        "조건",
        "필요",
        "결과",
        "안내",
        "검토",
        "변형",
    }
)


@dataclass(frozen=True)
class ClusterContext:
    cluster_id: int
    suggested_name: str
    workflow_signal: dict[str, bool]
    policy_ref: str | None = None
    workflow_events: tuple[str, ...] = ()


@dataclass(frozen=True)
class GraphNodeSpec:
    id: str
    type: str
    label: str
    policy_ref: str | None = None
    evidence_refs: tuple[dict[str, str], ...] = ()
    support: float | None = None
    slot_ref: str | None = None
    risk_ref: str | None = None


@dataclass(frozen=True)
class GraphEdgeSpec:
    id: str
    from_node: str
    to_node: str
    label: str | None = None
    support: float | None = None


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
    has_escalation = bool(signal.get("has_escalation_cases")) or "이관" in context.workflow_events
    policy_ref = context.policy_ref or DUMMY_POLICY_CODE

    pre_chain: list[GraphNodeSpec] = [GraphNodeSpec(id="start", type="START", label="시작")]
    if requires_identification:
        pre_chain.append(GraphNodeSpec(id="identify", type="ACTION", label="본인인증", policy_ref=policy_ref))
    if requires_payment:
        pre_chain.append(GraphNodeSpec(id="payment_check", type="ACTION", label="결제 확인", policy_ref=policy_ref))
    action = GraphNodeSpec(id="action", type="ACTION", label=context.suggested_name, policy_ref=policy_ref)
    full_chain = pre_chain + _observed_event_nodes(context.workflow_events, policy_ref) + [action]

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


def frequent_path_generator(
    context: ClusterContext,
    path_cases: Sequence[tuple[Sequence[str], str | None]],
    *,
    min_edge_support: float = 0.25,
    max_edges: int = 12,
) -> WorkflowGraphSpec:
    normalized_sequences = [_normalized_path(events, outcome) for events, outcome in path_cases]
    normalized_sequences = [sequence for sequence in normalized_sequences if len(sequence) >= 2]
    total = len(normalized_sequences)
    if total == 0:
        return signal_based_generator(context)

    transition_counts: Counter[tuple[str, str]] = Counter()
    node_counts: Counter[str] = Counter()
    for sequence in normalized_sequences:
        node_counts.update(set(sequence))
        transition_counts.update(set(zip(sequence, sequence[1:])))

    policy_ref = context.policy_ref or DUMMY_POLICY_CODE
    node_ids = {"START"}
    edge_specs: list[GraphEdgeSpec] = []
    edge_counter = 1
    threshold = max(1, math.ceil(total * min_edge_support))
    for (source, target), count in sorted(transition_counts.items(), key=lambda item: (-item[1], item[0])):
        if count < threshold:
            continue
        source_node = _token_node_id(source)
        target_node = _token_node_id(target)
        if source_node == target_node:
            continue
        if len(edge_specs) >= max_edges and not target_node.startswith("terminal"):
            continue
        node_ids.update((source, target))
        edge_specs.append(
            GraphEdgeSpec(
                id=f"e_{context.cluster_id}_{edge_counter}",
                from_node=source_node,
                to_node=target_node,
                label=_edge_label(source, target),
                support=round(count / total, 4),
            )
        )
        edge_counter += 1

    if not any(edge.to_node.startswith("terminal") for edge in edge_specs):
        return signal_based_generator(context)
    _remove_cycle_edges(edge_specs)
    edge_counter = _add_terminal_escape_edges(context, edge_specs, node_ids, edge_counter)
    edge_counter = _add_start_edges_to_unreachable_nodes(context, edge_specs, node_ids, edge_counter)

    node_specs = [
        _node_from_token(token, context.suggested_name, policy_ref, round(node_counts[token] / total, 4))
        for token in sorted(node_ids, key=_node_sort_key)
    ]
    return WorkflowGraphSpec(direction="LR", nodes=tuple(node_specs), edges=tuple(edge_specs))


def _remove_cycle_edges(edge_specs: list[GraphEdgeSpec]) -> None:
    acyclic_edges: list[GraphEdgeSpec] = []
    adjacency: dict[str, list[str]] = {}
    for edge in edge_specs:
        if _has_path(adjacency, edge.to_node, edge.from_node):
            continue
        acyclic_edges.append(edge)
        adjacency.setdefault(edge.from_node, []).append(edge.to_node)
        adjacency.setdefault(edge.to_node, [])
    edge_specs[:] = acyclic_edges


def _has_path(adjacency: dict[str, list[str]], start: str, target: str) -> bool:
    stack = [start]
    seen: set[str] = set()
    while stack:
        node_id = stack.pop()
        if node_id == target:
            return True
        if node_id in seen:
            continue
        seen.add(node_id)
        stack.extend(adjacency.get(node_id, ()))
    return False


def _add_terminal_escape_edges(
    context: ClusterContext,
    edge_specs: list[GraphEdgeSpec],
    node_ids: set[str],
    edge_counter: int,
) -> int:
    terminal_token = "TERMINAL_RESOLVED" if "TERMINAL_RESOLVED" in node_ids else _first_terminal_token(node_ids)
    if terminal_token is None:
        return edge_counter
    terminal_node = _token_node_id(terminal_token)
    outgoing = {edge.from_node for edge in edge_specs}
    for token in sorted(node_ids, key=_node_sort_key):
        node_id = _token_node_id(token)
        if token == "START" or node_id.startswith("terminal") or node_id in outgoing:
            continue
        edge_specs.append(
            GraphEdgeSpec(
                id=f"e_{context.cluster_id}_{edge_counter}",
                from_node=node_id,
                to_node=terminal_node,
                label="terminal_escape",
                support=0.0,
            )
        )
        edge_counter += 1
    return edge_counter


def _add_start_edges_to_unreachable_nodes(
    context: ClusterContext,
    edge_specs: list[GraphEdgeSpec],
    node_ids: set[str],
    edge_counter: int,
) -> int:
    reachable = _reachable_node_ids(edge_specs)
    existing_edges = {(edge.from_node, edge.to_node) for edge in edge_specs}
    for token in sorted(node_ids, key=_node_sort_key):
        node_id = _token_node_id(token)
        if token == "START" or node_id.startswith("terminal") or node_id in reachable:
            continue
        if ("start", node_id) in existing_edges:
            continue
        edge_specs.append(
            GraphEdgeSpec(
                id=f"e_{context.cluster_id}_{edge_counter}",
                from_node="start",
                to_node=node_id,
                label="observed_start",
                support=0.0,
            )
        )
        existing_edges.add(("start", node_id))
        reachable = _reachable_node_ids(edge_specs)
        edge_counter += 1
    return edge_counter


def _reachable_node_ids(edge_specs: Sequence[GraphEdgeSpec]) -> set[str]:
    adjacency: dict[str, list[str]] = {}
    for edge in edge_specs:
        adjacency.setdefault(edge.from_node, []).append(edge.to_node)
    reachable: set[str] = set()
    stack = ["start"]
    while stack:
        node_id = stack.pop()
        if node_id in reachable:
            continue
        reachable.add(node_id)
        stack.extend(adjacency.get(node_id, ()))
    return reachable


def _first_terminal_token(node_ids: set[str]) -> str | None:
    for token in sorted(node_ids):
        if _token_node_id(token).startswith("terminal"):
            return token
    return None


def graph_transition_coverage(
    path_cases: Sequence[tuple[Sequence[str], str | None]],
    graph_spec: WorkflowGraphSpec,
) -> float:
    edge_set = {(edge.from_node, edge.to_node) for edge in graph_spec.edges}
    case_scores: list[float] = []
    for events, outcome in path_cases:
        sequence = _normalized_path(events, outcome)
        transitions = [
            (_token_node_id(source), _token_node_id(target))
            for source, target in zip(sequence, sequence[1:])
            if _token_node_id(source) != _token_node_id(target)
        ]
        if not transitions:
            continue
        covered = sum(1 for transition in transitions if transition in edge_set)
        case_scores.append(covered / len(transitions))
    if not case_scores:
        return 0.0
    return round(sum(case_scores) / len(case_scores), 4)


def graph_transition_precision(
    path_cases: Sequence[tuple[Sequence[str], str | None]],
    graph_spec: WorkflowGraphSpec,
) -> float:
    observed_transitions = _observed_transition_set(path_cases)
    if not graph_spec.edges:
        return 0.0
    graph_edges = {(edge.from_node, edge.to_node) for edge in graph_spec.edges}
    if not graph_edges:
        return 0.0
    supported = sum(1 for edge in graph_edges if edge in observed_transitions)
    return round(supported / len(graph_edges), 4)


def graph_event_specificity(
    path_cases: Sequence[tuple[Sequence[str], str | None]],
    graph_spec: WorkflowGraphSpec,
) -> float:
    tokens: list[str] = []
    for events, outcome in path_cases:
        tokens.extend(
            token
            for token in _normalized_path(events, outcome)
            if token not in {"START", "TERMINAL_RESOLVED", "TERMINAL_ESCALATED"}
        )
    event_score = 0.0
    if tokens:
        unique_ratio = min(1.0, len(set(tokens)) / 6.0)
        non_generic_tokens = [token for token in tokens if token not in GENERIC_EVENT_TOKENS]
        non_generic_ratio = len(non_generic_tokens) / len(tokens)
        event_score = (0.40 * unique_ratio) + (0.60 * non_generic_ratio)
    graph_score = _graph_domain_specificity(graph_spec)
    if not tokens:
        return round(0.35 * graph_score, 4)
    return round((0.65 * event_score) + (0.35 * graph_score), 4)


def _graph_domain_specificity(graph_spec: WorkflowGraphSpec) -> float:
    scored_nodes = [
        _node_domain_specificity(node) for node in graph_spec.nodes if node.type not in {"START", "TERMINAL", "HANDOFF"}
    ]
    if not scored_nodes:
        return 0.0
    return sum(scored_nodes) / len(scored_nodes)


def _node_domain_specificity(node: GraphNodeSpec) -> float:
    if node.slot_ref or node.risk_ref:
        return 1.0
    if node.id.startswith(("collect_slot_", "risk_check_")) or node.id == "policy_control":
        return 1.0
    if any(_evidence_ref_is_specific(ref) for ref in node.evidence_refs):
        return 1.0
    if _label_is_specific(node.label):
        return 1.0
    return 0.0


def _evidence_ref_is_specific(ref: dict[str, str]) -> bool:
    ref_type = ref.get("type")
    value = ref.get("value", "")
    if ref_type in {"route_term", "slot_ref", "policy_ref", "risk_ref"}:
        return _label_is_specific(value)
    if ref_type == "flow_event":
        return value not in GENERIC_EVENT_TOKENS
    return False


def _label_is_specific(label: str) -> bool:
    normalized = " ".join(label.split())
    if not normalized or normalized in GENERIC_NODE_LABELS:
        return False
    terms = re.findall(r"[0-9A-Za-z가-힣_]+", normalized.casefold())
    return any(term not in GENERIC_LABEL_TERMS and len(term) >= 2 for term in terms)


def _observed_transition_set(path_cases: Sequence[tuple[Sequence[str], str | None]]) -> set[tuple[str, str]]:
    observed: set[tuple[str, str]] = set()
    for events, outcome in path_cases:
        sequence = _normalized_path(events, outcome)
        observed.update(
            (_token_node_id(source), _token_node_id(target))
            for source, target in zip(sequence, sequence[1:])
            if _token_node_id(source) != _token_node_id(target)
        )
    return observed


def serialize_graph_json(spec: WorkflowGraphSpec) -> str:
    nodes_list: list[dict[str, object]] = []
    for node in spec.nodes:
        node_dict: dict[str, object] = {"id": node.id, "type": node.type, "label": node.label}
        if node.policy_ref is not None:
            node_dict["policyRef"] = node.policy_ref
        if node.evidence_refs:
            node_dict["evidenceRefs"] = list(node.evidence_refs)
        if node.support is not None:
            node_dict["support"] = node.support
        if node.slot_ref is not None:
            node_dict["slotRef"] = node.slot_ref
        if node.risk_ref is not None:
            node_dict["riskRef"] = node.risk_ref
        nodes_list.append(node_dict)

    edges_list: list[dict[str, object]] = []
    for edge in spec.edges:
        edge_dict: dict[str, object] = {"id": edge.id, "from": edge.from_node, "to": edge.to_node}
        if edge.label is not None:
            edge_dict["label"] = edge.label
        if edge.support is not None:
            edge_dict["support"] = edge.support
        edges_list.append(edge_dict)

    return json.dumps({"direction": spec.direction, "nodes": nodes_list, "edges": edges_list}, ensure_ascii=False)


def _observed_event_nodes(events: tuple[str, ...], policy_ref: str) -> list[GraphNodeSpec]:
    nodes: list[GraphNodeSpec] = []
    seen: set[str] = set()
    for event in events:
        node = _event_node(event, policy_ref)
        if node is None or node.id in seen:
            continue
        seen.add(node.id)
        nodes.append(node)
        if len(nodes) >= 4:
            break
    return nodes


def _event_node(event: str, policy_ref: str) -> GraphNodeSpec | None:
    evidence_refs = ({"type": "flow_event", "value": event},)
    if event == "확인질문":
        return GraphNodeSpec("request_check", "ACTION", "요청 내용 확인", policy_ref, evidence_refs)
    if event == "추가정보요청":
        return GraphNodeSpec("info_collect", "ACTION", "필요 정보 수집", policy_ref, evidence_refs)
    if event == "정책안내":
        return GraphNodeSpec("policy_check", "ACTION", "처리 기준 확인", policy_ref, evidence_refs)
    if event == "불만표현":
        return GraphNodeSpec("issue_review", "ACTION", "문제 상황 확인", policy_ref, evidence_refs)
    if event == "예외처리":
        return GraphNodeSpec("exception_review", "ACTION", "예외 처리 검토", policy_ref, evidence_refs)
    if event == "해결":
        return GraphNodeSpec("result_notice", "ACTION", "처리 결과 안내", policy_ref, evidence_refs)
    return None


def _normalized_path(events: Sequence[str], outcome: str | None) -> tuple[str, ...]:
    collapsed = _collapse_events([event for event in events if event])
    terminal = "TERMINAL_ESCALATED" if outcome == "escalated" or "이관" in collapsed else "TERMINAL_RESOLVED"
    event_tokens = [event for event in collapsed if event != "이관"]
    if "이관" in collapsed and "HANDOFF" not in event_tokens:
        event_tokens.append("HANDOFF")
    return tuple(["START", *event_tokens, terminal])


def _collapse_events(events: Sequence[str]) -> list[str]:
    output: list[str] = []
    for event in events:
        if event and (not output or output[-1] != event):
            output.append(event)
    return output


def _node_from_token(token: str, suggested_name: str, policy_ref: str, support: float) -> GraphNodeSpec:
    if token == "START":
        return GraphNodeSpec("start", "START", "시작", support=support)
    if token == "TERMINAL_RESOLVED":
        return GraphNodeSpec("terminal", "TERMINAL", "종료", support=support)
    if token == "TERMINAL_ESCALATED":
        return GraphNodeSpec("terminal_escalated", "TERMINAL", "상담원 이관 종료", support=support)
    if token == "HANDOFF":
        return GraphNodeSpec(
            "handoff",
            "HANDOFF",
            "상담원 연결",
            evidence_refs=({"type": "flow_event", "value": "이관"},),
            support=support,
        )
    node = _event_node(token, policy_ref)
    if node is not None:
        return GraphNodeSpec(
            node.id,
            node.type,
            node.label,
            node.policy_ref,
            node.evidence_refs,
            support,
        )
    return GraphNodeSpec(
        f"observed_{_stable_token_suffix(token)}",
        "ACTION",
        suggested_name,
        policy_ref,
        ({"type": "flow_event", "value": token},),
        support,
    )


def _token_node_id(token: str) -> str:
    if token == "START":
        return "start"
    if token == "TERMINAL_RESOLVED":
        return "terminal"
    if token == "TERMINAL_ESCALATED":
        return "terminal_escalated"
    if token == "HANDOFF":
        return "handoff"
    node = _event_node(token, DUMMY_POLICY_CODE)
    if node is not None:
        return node.id
    return f"observed_{_stable_token_suffix(token)}"


def _edge_label(source: str, target: str) -> str | None:
    if target == "TERMINAL_RESOLVED":
        return "resolved"
    if target == "TERMINAL_ESCALATED":
        return "escalated"
    if source == "START":
        return None
    return "observed"


def _node_sort_key(token: str) -> tuple[int, str]:
    if token == "START":
        return (0, token)
    if token.startswith("TERMINAL"):
        return (9, token)
    return (5, token)


def _stable_token_suffix(token: str) -> str:
    return hashlib.blake2b(token.encode("utf-8"), digest_size=3).hexdigest()
