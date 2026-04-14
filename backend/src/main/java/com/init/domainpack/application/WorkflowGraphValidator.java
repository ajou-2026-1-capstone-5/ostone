package com.init.domainpack.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import com.init.domainpack.application.exception.WorkflowCycleDetectedException;
import com.init.domainpack.application.exception.WorkflowDanglingEdgeException;
import com.init.domainpack.application.exception.WorkflowInvalidStartNodeException;
import com.init.domainpack.application.exception.WorkflowInvalidTerminalNodeException;
import com.init.domainpack.application.exception.WorkflowUnlabeledBranchException;
import com.init.domainpack.application.exception.WorkflowUnreachableNodeException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;

final class WorkflowGraphValidator {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private WorkflowGraphValidator() {}

  record ParsedGraph(List<GraphNode> nodes, List<GraphEdge> edges) {}

  record GraphNode(String id, String type) {}

  record GraphEdge(String from, String to, String label) {}

  /** V1-V6 검증 후 ParsedGraph 반환. 위반 시 해당 예외를 throw한다 (fail-fast). */
  static ParsedGraph parseAndValidate(String graphJson, String workflowCode) {
    JsonNode root;
    try {
      root = OBJECT_MAPPER.readTree(graphJson);
    } catch (JsonProcessingException e) {
      throw new DomainPackDraftRequestInvalidException(
          "graphJson 파싱 실패. workflowCode=" + workflowCode, e);
    }

    List<GraphNode> nodes = parseNodes(root);
    List<GraphEdge> edges = parseEdges(root);

    validateV1StartNode(nodes, workflowCode);
    validateV2TerminalNode(nodes, workflowCode);

    Set<String> nodeIds = buildNodeIdSet(nodes);
    validateV3DanglingEdges(edges, nodeIds, workflowCode);

    Map<String, List<String>> adj = buildAdjacencyList(nodes, edges);
    String startId = findStartNodeId(nodes);
    validateV4Reachability(nodes, adj, startId, workflowCode);
    validateV5Cycles(nodes, adj, workflowCode);
    validateV6DecisionLabels(nodes, edges, workflowCode);

    return new ParsedGraph(nodes, edges);
  }

  static String extractInitialState(ParsedGraph graph) {
    return graph.nodes().stream()
        .filter(n -> "START".equals(n.type()))
        .findFirst()
        .map(GraphNode::id)
        .orElseThrow(
            () ->
                new IllegalStateException(
                    "START node must exist after validation — this is a bug"));
  }

  static String extractTerminalStatesJson(ParsedGraph graph) {
    List<String> terminalIds =
        graph.nodes().stream().filter(n -> "TERMINAL".equals(n.type())).map(GraphNode::id).toList();
    try {
      return OBJECT_MAPPER.writeValueAsString(terminalIds);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Failed to serialize terminal states", e);
    }
  }

  // --- parse helpers ---

  private static List<GraphNode> parseNodes(JsonNode root) {
    List<GraphNode> nodes = new ArrayList<>();
    for (JsonNode n : root.path("nodes")) {
      nodes.add(new GraphNode(n.path("id").asText(), n.path("type").asText()));
    }
    return nodes;
  }

  private static List<GraphEdge> parseEdges(JsonNode root) {
    List<GraphEdge> edges = new ArrayList<>();
    for (JsonNode e : root.path("edges")) {
      String label = e.hasNonNull("label") ? e.path("label").asText(null) : null;
      edges.add(new GraphEdge(e.path("from").asText(), e.path("to").asText(), label));
    }
    return edges;
  }

  // --- validation rules ---

  private static void validateV1StartNode(List<GraphNode> nodes, String workflowCode) {
    long startCount = nodes.stream().filter(n -> "START".equals(n.type())).count();
    if (startCount != 1) {
      throw new WorkflowInvalidStartNodeException(workflowCode);
    }
  }

  private static void validateV2TerminalNode(List<GraphNode> nodes, String workflowCode) {
    long terminalCount = nodes.stream().filter(n -> "TERMINAL".equals(n.type())).count();
    if (terminalCount < 1) {
      throw new WorkflowInvalidTerminalNodeException(workflowCode);
    }
  }

  private static void validateV3DanglingEdges(
      List<GraphEdge> edges, Set<String> nodeIds, String workflowCode) {
    for (GraphEdge edge : edges) {
      if (!nodeIds.contains(edge.from()) || !nodeIds.contains(edge.to())) {
        throw new WorkflowDanglingEdgeException(workflowCode);
      }
    }
  }

  private static void validateV4Reachability(
      List<GraphNode> nodes, Map<String, List<String>> adj, String startId, String workflowCode) {
    Set<String> reachable = new HashSet<>();
    Deque<String> queue = new ArrayDeque<>();
    queue.add(startId);
    while (!queue.isEmpty()) {
      String current = queue.poll();
      if (reachable.add(current)) {
        adj.getOrDefault(current, List.of()).forEach(queue::add);
      }
    }
    if (reachable.size() != nodes.size()) {
      throw new WorkflowUnreachableNodeException(workflowCode);
    }
  }

  private static void validateV5Cycles(
      List<GraphNode> nodes, Map<String, List<String>> adj, String workflowCode) {
    Map<String, Integer> inDegree = new HashMap<>();
    for (GraphNode n : nodes) inDegree.put(n.id(), 0);
    for (GraphNode n : nodes) {
      for (String neighbor : adj.getOrDefault(n.id(), List.of())) {
        inDegree.merge(neighbor, 1, Integer::sum);
      }
    }

    Deque<String> topoQueue = new ArrayDeque<>();
    inDegree.forEach(
        (id, degree) -> {
          if (degree == 0) topoQueue.add(id);
        });

    int processed = 0;
    while (!topoQueue.isEmpty()) {
      String current = topoQueue.poll();
      processed++;
      for (String neighbor : adj.getOrDefault(current, List.of())) {
        int newDegree = inDegree.merge(neighbor, -1, Integer::sum);
        if (newDegree == 0) topoQueue.add(neighbor);
      }
    }
    if (processed != nodes.size()) {
      throw new WorkflowCycleDetectedException(workflowCode);
    }
  }

  private static void validateV6DecisionLabels(
      List<GraphNode> nodes, List<GraphEdge> edges, String workflowCode) {
    Set<String> decisionIds = new HashSet<>();
    for (GraphNode n : nodes) {
      if ("DECISION".equals(n.type())) decisionIds.add(n.id());
    }
    for (GraphEdge edge : edges) {
      if (decisionIds.contains(edge.from()) && (edge.label() == null || edge.label().isBlank())) {
        throw new WorkflowUnlabeledBranchException(workflowCode);
      }
    }
  }

  // --- utility ---

  private static Set<String> buildNodeIdSet(List<GraphNode> nodes) {
    Set<String> ids = new HashSet<>();
    for (GraphNode n : nodes) ids.add(n.id());
    return ids;
  }

  private static Map<String, List<String>> buildAdjacencyList(
      List<GraphNode> nodes, List<GraphEdge> edges) {
    Map<String, List<String>> adj = new HashMap<>();
    for (GraphNode n : nodes) adj.put(n.id(), new ArrayList<>());
    for (GraphEdge e : edges) adj.get(e.from()).add(e.to());
    return adj;
  }

  private static String findStartNodeId(List<GraphNode> nodes) {
    return nodes.stream()
        .filter(n -> "START".equals(n.type()))
        .findFirst()
        .map(GraphNode::id)
        .orElseThrow(() -> new NoSuchElementException("Start node not found in workflow graph"));
  }
}
