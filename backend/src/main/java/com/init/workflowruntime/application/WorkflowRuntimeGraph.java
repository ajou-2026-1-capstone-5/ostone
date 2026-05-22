package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import com.init.shared.application.exception.InternalException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class WorkflowRuntimeGraph {

  private final Map<String, RuntimeNode> nodesById;
  private final Map<String, List<RuntimeEdge>> outgoingEdgesByNodeId;

  private WorkflowRuntimeGraph(
      Map<String, RuntimeNode> nodesById, Map<String, List<RuntimeEdge>> outgoingEdgesByNodeId) {
    this.nodesById = nodesById;
    this.outgoingEdgesByNodeId = outgoingEdgesByNodeId;
  }

  static WorkflowRuntimeGraph parse(ObjectMapper objectMapper, String graphJson, Long workflowId) {
    try {
      JsonNode root = objectMapper.readTree(graphJson);
      Map<String, RuntimeNode> nodesById = parseNodes(root, workflowId);
      Map<String, List<RuntimeEdge>> outgoingEdgesByNodeId = parseEdges(root, workflowId);
      return new WorkflowRuntimeGraph(nodesById, outgoingEdgesByNodeId);
    } catch (JsonProcessingException | IllegalArgumentException e) {
      throw new InternalException(
          "WORKFLOW_GRAPH_PARSE_FAILED", "Workflow graphJson cannot be parsed: " + workflowId, e);
    }
  }

  RuntimeNode requireNode(String nodeId) {
    RuntimeNode node = nodesById.get(trimToNull(nodeId));
    if (node == null) {
      throw new InternalException(
          "WORKFLOW_STATE_NOT_FOUND", "Workflow state not found: " + nodeId);
    }
    return node;
  }

  RuntimeNode findNode(String nodeId) {
    return nodesById.get(trimToNull(nodeId));
  }

  List<RuntimeEdge> outgoingEdges(String nodeId) {
    return outgoingEdgesByNodeId.getOrDefault(nodeId, List.of());
  }

  private static Map<String, RuntimeNode> parseNodes(JsonNode root, Long workflowId) {
    Map<String, RuntimeNode> nodesById = new LinkedHashMap<>();
    for (JsonNode node : root.path("nodes")) {
      String id = trimToNull(node.path("id").asText(null));
      String type = trimToNull(node.path("type").asText(null));
      if (id == null || type == null) {
        throw new InternalException(
            "WORKFLOW_GRAPH_INVALID", "Workflow graph node is invalid: " + workflowId);
      }
      String policyRef = trimToNull(node.path("policyRef").asText(null));
      nodesById.put(id, new RuntimeNode(id, type, policyRef));
    }
    return nodesById;
  }

  private static Map<String, List<RuntimeEdge>> parseEdges(JsonNode root, Long workflowId) {
    Map<String, List<RuntimeEdge>> outgoingEdgesByNodeId = new LinkedHashMap<>();
    for (JsonNode edge : root.path("edges")) {
      String id = trimToNull(edge.path("id").asText(null));
      String from = trimToNull(edge.path("from").asText(null));
      String to = trimToNull(edge.path("to").asText(null));
      if (id == null || from == null || to == null) {
        throw new InternalException(
            "WORKFLOW_GRAPH_INVALID", "Workflow graph edge is invalid: " + workflowId);
      }
      JsonNode condition = edge.has("condition") ? edge.path("condition") : NullNode.getInstance();
      outgoingEdgesByNodeId
          .computeIfAbsent(from, ignored -> new ArrayList<>())
          .add(new RuntimeEdge(id, from, to, condition));
    }
    return outgoingEdgesByNodeId;
  }

  private static String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  record RuntimeNode(String id, String type, String policyRef) {}

  record RuntimeEdge(String id, String from, String to, JsonNode condition) {}
}
