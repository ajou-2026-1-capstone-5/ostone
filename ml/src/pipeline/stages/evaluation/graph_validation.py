from __future__ import annotations

import json
from typing import Any, cast


def _graph_validity(workflows: list[dict[str, Any]]) -> str:
    return "passed" if not _graph_validation_errors(workflows) else "failed"


def _graph_validation_errors(workflows: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    for workflow in workflows:
        graph = _parse_graph(workflow.get("graphJson"))
        if graph is None:
            errors.append("graph_json_invalid")
            continue
        nodes, edges = _graph_nodes_and_edges(graph)
        if nodes is None or edges is None:
            errors.append("graph_shape_invalid")
            continue
        node_errors = _node_validation_errors(nodes)
        edge_errors = _edge_validation_errors(nodes, edges)
        reachability_errors = _reachability_validation_errors(nodes, edges)
        errors.extend(node_errors + edge_errors + reachability_errors)
    return errors


def _node_validation_errors(nodes: list[object]) -> list[str]:
    node_dicts = [node for node in nodes if isinstance(node, dict)]
    node_ids = [node.get("id") for node in node_dicts]
    errors: list[str] = []
    if len(node_ids) != len(set(node_ids)):
        errors.append("duplicate_node_id")
    if not any(node.get("type") == "START" for node in node_dicts):
        errors.append("missing_start_node")
    if not _has_terminal_node(nodes):
        errors.append("missing_terminal_node")
    allowed_types = {"START", "ACTION", "DECISION", "HANDOFF", "TERMINAL"}
    if any(node.get("type") not in allowed_types for node in node_dicts):
        errors.append("unknown_node_type")
    if len(node_dicts) != len(nodes):
        errors.append("malformed_node")
    return errors


def _edge_validation_errors(nodes: list[object], edges: list[object]) -> list[str]:
    errors: list[str] = []
    if not _edges_reference_existing_nodes(nodes, edges):
        errors.append("edge_endpoint_missing")
    if any(not isinstance(edge, dict) or not isinstance(edge.get("id"), str) for edge in edges):
        errors.append("malformed_edge")
    edge_ids = [edge.get("id") for edge in edges if isinstance(edge, dict)]
    if len(edge_ids) != len(set(edge_ids)):
        errors.append("duplicate_edge_id")
    return errors


def _reachability_validation_errors(nodes: list[object], edges: list[object]) -> list[str]:
    node_dicts = [node for node in nodes if isinstance(node, dict) and isinstance(node.get("id"), str)]
    node_by_id = {str(node["id"]): node for node in node_dicts}
    starts = [node_id for node_id, node in node_by_id.items() if node.get("type") == "START"]
    terminals = {node_id for node_id, node in node_by_id.items() if node.get("type") == "TERMINAL"}
    adjacency: dict[str, list[str]] = {node_id: [] for node_id in node_by_id}
    incoming: dict[str, int] = {node_id: 0 for node_id in node_by_id}
    for edge in edges:
        if not isinstance(edge, dict) or not isinstance(edge.get("from"), str) or not isinstance(edge.get("to"), str):
            continue
        source = str(edge["from"])
        target = str(edge["to"])
        if source in adjacency and target in incoming:
            adjacency[source].append(target)
            incoming[target] += 1
    reachable = _reachable_nodes(starts, adjacency)
    errors: list[str] = []
    if terminals and not (reachable & terminals):
        errors.append("terminal_unreachable")
    if any(node_id not in reachable for node_id in node_by_id):
        errors.append("unreachable_node")
    dead_non_terminal = [
        node_id
        for node_id, node in node_by_id.items()
        if node.get("type") != "TERMINAL" and node_id in reachable and not adjacency.get(node_id)
    ]
    if dead_non_terminal:
        errors.append("dead_non_terminal_node")
    orphan_non_start = [
        node_id
        for node_id, node in node_by_id.items()
        if node.get("type") != "START" and node_id in reachable and incoming.get(node_id, 0) == 0
    ]
    if orphan_non_start:
        errors.append("orphan_node")
    return errors


def _reachable_nodes(starts: list[str], adjacency: dict[str, list[str]]) -> set[str]:
    seen: set[str] = set()
    stack = list(starts)
    while stack:
        node_id = stack.pop()
        if node_id in seen:
            continue
        seen.add(node_id)
        stack.extend(target for target in adjacency.get(node_id, []) if target not in seen)
    return seen


def _parse_graph(graph_raw: object) -> dict[str, Any] | None:
    if not isinstance(graph_raw, str):
        return None
    try:
        graph = json.loads(graph_raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(graph, dict):
        return None
    return cast(dict[str, Any], graph)


def _graph_nodes_and_edges(graph: dict[str, Any]) -> tuple[list[object] | None, list[object] | None]:
    nodes = graph.get("nodes")
    edges = graph.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        return None, None
    return nodes, edges


def _has_terminal_node(nodes: list[object]) -> bool:
    return any(isinstance(node, dict) and node.get("type") == "TERMINAL" for node in nodes)


def _edges_reference_existing_nodes(nodes: list[object], edges: list[object]) -> bool:
    node_ids = {node.get("id") for node in nodes if isinstance(node, dict)}
    return all(isinstance(edge, dict) and edge.get("from") in node_ids and edge.get("to") in node_ids for edge in edges)
