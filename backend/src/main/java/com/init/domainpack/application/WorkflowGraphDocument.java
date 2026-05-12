package com.init.domainpack.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefInvalidCharsException;
import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefMissingException;
import com.init.domainpack.application.exception.WorkflowGraphJsonInvalidException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

final class WorkflowGraphDocument {

  private static final Logger log = LoggerFactory.getLogger(WorkflowGraphDocument.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Pattern POLICY_REF_PATTERN = Pattern.compile("[A-Za-z0-9_-]+");

  private final Long workflowId;
  private final ObjectNode root;
  private final Map<String, ObjectNode> nodeMap;

  private WorkflowGraphDocument(Long workflowId, ObjectNode root, Map<String, ObjectNode> nodeMap) {
    this.workflowId = workflowId;
    this.root = root;
    this.nodeMap = nodeMap;
  }

  static WorkflowGraphDocument parse(String graphJson, Long workflowId) {
    if (graphJson == null) {
      throw new WorkflowGraphJsonInvalidException(
          workflowId, new IllegalArgumentException("graphJson is null"));
    }
    try {
      JsonNode parsed = MAPPER.readTree(graphJson);
      if (!(parsed instanceof ObjectNode objectNode)) {
        throw new IllegalArgumentException("graphJson root must be an object");
      }
      return new WorkflowGraphDocument(
          workflowId, objectNode, buildNodeMap(objectNode, workflowId));
    } catch (JsonProcessingException | IllegalArgumentException e) {
      throw new WorkflowGraphJsonInvalidException(workflowId, e);
    }
  }

  List<WorkflowTransitionDetail> listTransitionDetails(Long versionId) {
    List<WorkflowTransitionDetail> result = new ArrayList<>();
    for (JsonNode edge : root.path("edges")) {
      String edgeId = text(edge, "id");
      if (edgeId == null || edgeId.isBlank()) {
        log.warn(
            "skipping edge with missing id: workflowId={}, versionId={}", workflowId, versionId);
        continue;
      }
      result.add(buildDetail(edge, edgeId.trim(), versionId));
    }
    return result;
  }

  Optional<WorkflowTransitionDetail> findTransitionDetail(String transitionId, Long versionId) {
    return findEdge(transitionId).map(edge -> buildDetail(edge, transitionId, versionId));
  }

  Optional<ObjectNode> findEdge(String transitionId) {
    for (JsonNode edge : root.path("edges")) {
      String edgeId = text(edge, "id");
      if (transitionId.equals(edgeId == null ? null : edgeId.trim())) {
        if (edge instanceof ObjectNode objectNode) {
          return Optional.of(objectNode);
        }
        throw new WorkflowGraphJsonInvalidException(
            workflowId, new IllegalArgumentException("edge must be an object"));
      }
    }
    return Optional.empty();
  }

  ObjectNode requireFromNode(ObjectNode edge) {
    return requireNode(text(edge, "from"));
  }

  ObjectNode requireToNode(ObjectNode edge) {
    return requireNode(text(edge, "to"));
  }

  Set<String> collectActionPolicyRefs() {
    Set<String> policyRefs = new LinkedHashSet<>();
    for (ObjectNode node : nodeMap.values()) {
      if (!"ACTION".equals(text(node, "type"))) {
        continue;
      }
      String policyRef = text(node, "policyRef");
      if (policyRef != null && !policyRef.isBlank()) {
        policyRefs.add(policyRef);
      }
    }
    return policyRefs;
  }

  String toJson() {
    try {
      return MAPPER.writeValueAsString(root);
    } catch (JsonProcessingException e) {
      throw new WorkflowGraphJsonInvalidException(workflowId, e);
    }
  }

  void putText(ObjectNode node, String fieldName, String value) {
    node.put(fieldName, value);
  }

  private WorkflowTransitionDetail buildDetail(JsonNode edge, String edgeId, Long versionId) {
    String fromNodeId = trimToNull(text(edge, "from"));
    String toNodeId = trimToNull(text(edge, "to"));
    ObjectNode fromNode = fromNodeId == null ? null : nodeMap.get(fromNodeId);
    ObjectNode toNode = toNodeId == null ? null : nodeMap.get(toNodeId);
    String fromType = fromNode == null ? null : trimToNull(text(fromNode, "type"));
    String toType = toNode == null ? null : trimToNull(text(toNode, "type"));

    boolean conditionEditable = "DECISION".equals(fromType);
    boolean actionEditable = "ACTION".equals(toType);
    boolean outcomeEditable = "TERMINAL".equals(toType);

    String label = conditionEditable ? text(edge, "label") : null;
    String policyRef = actionEditable && toNode != null ? text(toNode, "policyRef") : null;
    String outcomeState = outcomeEditable && toNode != null ? text(toNode, "state") : null;
    String outcomeLabel = outcomeEditable && toNode != null ? text(toNode, "label") : null;

    return new WorkflowTransitionDetail(
        edgeId,
        workflowId,
        versionId,
        fromNodeId,
        toNodeId,
        fromType,
        toType,
        label,
        policyRef,
        new WorkflowTransitionDetail.TransitionConditionDetail(conditionEditable, label),
        new WorkflowTransitionDetail.TransitionActionDetail(actionEditable, policyRef),
        new WorkflowTransitionDetail.TransitionOutcomeDetail(
            outcomeEditable, outcomeState, outcomeLabel));
  }

  private static Map<String, ObjectNode> buildNodeMap(ObjectNode root, Long workflowId) {
    Map<String, ObjectNode> nodes = new HashMap<>();
    for (JsonNode node : root.path("nodes")) {
      if (!(node instanceof ObjectNode objectNode)) {
        throw new WorkflowGraphJsonInvalidException(
            workflowId, new IllegalArgumentException("node must be an object"));
      }
      String nodeId = trimToNull(text(objectNode, "id"));
      String nodeType = trimToNull(text(objectNode, "type"));
      if (nodeId == null) {
        continue;
      }
      nodes.put(nodeId, objectNode);
      if ("ACTION".equals(nodeType)) {
        validateActionPolicyRef(workflowId, nodeId, text(objectNode, "policyRef"));
      }
    }
    return nodes;
  }

  private ObjectNode requireNode(String nodeId) {
    ObjectNode node = nodeMap.get(trimToNull(nodeId));
    if (node == null) {
      throw new WorkflowGraphJsonInvalidException(
          workflowId, new IllegalArgumentException("node not found: " + nodeId));
    }
    return node;
  }

  private static void validateActionPolicyRef(Long workflowId, String nodeId, String policyRef) {
    if (policyRef == null || policyRef.isBlank()) {
      throw new WorkflowActionNodePolicyRefMissingException(workflowId, nodeId);
    }
    if (!POLICY_REF_PATTERN.matcher(policyRef).matches()) {
      throw new WorkflowActionNodePolicyRefInvalidCharsException(workflowId, nodeId);
    }
  }

  private static String text(JsonNode node, String fieldName) {
    if (node == null || !node.hasNonNull(fieldName)) {
      return null;
    }
    return node.path(fieldName).asText(null);
  }

  private static String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
