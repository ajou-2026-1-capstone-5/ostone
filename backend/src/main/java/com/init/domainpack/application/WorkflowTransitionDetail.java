package com.init.domainpack.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefInvalidCharsException;
import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefMissingException;
import com.init.domainpack.application.exception.WorkflowGraphJsonInvalidException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public record WorkflowTransitionDetail(
    String id,
    Long workflowDefinitionId,
    Long domainPackVersionId,
    String from,
    String to,
    String label,
    String toPolicyRef) {

  private static final Logger log = LoggerFactory.getLogger(WorkflowTransitionDetail.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Pattern POLICY_REF_PATTERN = Pattern.compile("[A-Za-z0-9_-]+");

  static List<WorkflowTransitionDetail> listFromGraphJson(
      String graphJson, Long workflowId, Long versionId) {
    if (graphJson == null) {
      throw new WorkflowGraphJsonInvalidException(
          workflowId, new IllegalArgumentException("graphJson is null"));
    }
    try {
      JsonNode root = MAPPER.readTree(graphJson);
      NodeMaps nodeMaps = buildNodeMaps(root, workflowId);
      List<WorkflowTransitionDetail> result = new ArrayList<>();
      for (JsonNode e : root.path("edges")) {
        String edgeId = e.hasNonNull("id") ? e.path("id").asText(null) : null;
        if (edgeId == null || edgeId.isBlank()) {
          log.warn(
              "skipping edge with missing id: workflowId={}, versionId={}", workflowId, versionId);
          continue;
        }
        result.add(buildDetail(e, edgeId, workflowId, versionId, nodeMaps));
      }
      return result;
    } catch (IOException | IllegalArgumentException e) {
      throw new WorkflowGraphJsonInvalidException(workflowId, e);
    }
  }

  static Optional<WorkflowTransitionDetail> fromGraphJson(
      String graphJson, String transitionId, Long workflowId, Long versionId) {
    if (graphJson == null) {
      throw new WorkflowGraphJsonInvalidException(
          workflowId, new IllegalArgumentException("graphJson is null"));
    }
    try {
      JsonNode root = MAPPER.readTree(graphJson);
      NodeMaps nodeMaps = buildNodeMaps(root, workflowId);
      for (JsonNode e : root.path("edges")) {
        String edgeId = e.hasNonNull("id") ? e.path("id").asText(null) : null;
        if (transitionId.equals(edgeId)) {
          return Optional.of(buildDetail(e, edgeId, workflowId, versionId, nodeMaps));
        }
      }
      return Optional.empty();
    } catch (IOException | IllegalArgumentException e) {
      throw new WorkflowGraphJsonInvalidException(workflowId, e);
    }
  }

  private static NodeMaps buildNodeMaps(JsonNode root, Long workflowId) {
    Map<String, String> nodeTypeMap = new HashMap<>();
    Map<String, String> actionPolicyRefMap = new HashMap<>();
    for (JsonNode n : root.path("nodes")) {
      String nodeId = n.path("id").asText().trim();
      String nodeType = n.path("type").asText().trim();
      nodeTypeMap.put(nodeId, nodeType);
      if ("ACTION".equals(nodeType)) {
        String policyRef = n.hasNonNull("policyRef") ? n.path("policyRef").asText(null) : null;
        if (policyRef == null || policyRef.isBlank()) {
          throw new WorkflowActionNodePolicyRefMissingException(workflowId, nodeId);
        }
        if (!POLICY_REF_PATTERN.matcher(policyRef).matches()) {
          throw new WorkflowActionNodePolicyRefInvalidCharsException(workflowId, nodeId);
        }
        actionPolicyRefMap.put(nodeId, policyRef);
      }
    }
    return new NodeMaps(nodeTypeMap, actionPolicyRefMap);
  }

  private static WorkflowTransitionDetail buildDetail(
      JsonNode e, String edgeId, Long workflowId, Long versionId, NodeMaps nodeMaps) {
    String fromNodeId = e.path("from").asText().trim();
    String toNodeId = e.path("to").asText().trim();
    String label =
        "DECISION".equals(nodeMaps.nodeTypeMap().get(fromNodeId))
            ? (e.hasNonNull("label") ? e.path("label").asText(null) : null)
            : null;
    String toPolicyRef =
        "ACTION".equals(nodeMaps.nodeTypeMap().get(toNodeId))
            ? nodeMaps.actionPolicyRefMap().get(toNodeId)
            : null;
    return new WorkflowTransitionDetail(
        edgeId, workflowId, versionId, fromNodeId, toNodeId, label, toPolicyRef);
  }

  private record NodeMaps(
      Map<String, String> nodeTypeMap, Map<String, String> actionPolicyRefMap) {}
}
