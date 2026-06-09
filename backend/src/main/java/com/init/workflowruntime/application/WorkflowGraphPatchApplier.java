package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.workflowruntime.domain.InvalidStructuralPatchException;
import com.init.workflowruntime.domain.StructuralPatchOperation;
import com.init.workflowruntime.domain.StructuralPatchOperation.WorkflowNode;
import com.init.workflowruntime.domain.StructuralPatchOperation.WorkflowTransition;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import org.springframework.stereotype.Component;

/**
 * 단일 workflow의 graphJson에 구조적 node/transition operation을 적용해 새 graphJson을 만든다. 알 수 없는 필드/노드 속성은 그대로
 * 보존하며, 도달 가능성/순환/초기 상태 등 그래프 전역 불변식은 호출 측이 {@code WorkflowGraphValidator}로 최종 검증한다.
 */
@Component
public class WorkflowGraphPatchApplier {

  private static final Set<String> USER_FACING_NODE_TYPES = Set.of("ANSWER", "HANDOFF");

  private final ObjectMapper objectMapper;

  public WorkflowGraphPatchApplier(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  /** 주어진 workflow operation들을 순서대로 적용한 새 graphJson을 반환한다. */
  public String apply(
      String graphJson, List<StructuralPatchOperation> operations, Predicate<String> slotExists) {
    ObjectNode root = readObject(graphJson);
    ArrayNode nodes = arrayChild(root, "nodes");
    ArrayNode edges = arrayChild(root, "edges");

    for (StructuralPatchOperation operation : operations) {
      switch (operation) {
        case WorkflowNode node -> applyNode(nodes, node, slotExists);
        case WorkflowTransition transition -> applyTransition(edges, transition);
        default ->
            throw new InvalidStructuralPatchException(
                "workflow graph에 적용할 수 없는 operation입니다: " + operation.type());
      }
    }

    verifyNoDuplicateNodeIds(nodes);
    return write(root);
  }

  /** responseCode와 동일한 node가 있으면 그 node의 copy를 설정한 새 graphJson을 반환한다. 없으면 비어있는 결과. */
  public Optional<String> applyResponseCopy(String graphJson, String nodeId, String copy) {
    ObjectNode root = readObject(graphJson);
    ObjectNode node = findNode(arrayChild(root, "nodes"), nodeId);
    if (node == null) {
      return Optional.empty();
    }
    node.put("copy", copy);
    return Optional.of(write(root));
  }

  private void applyNode(ArrayNode nodes, WorkflowNode op, Predicate<String> slotExists) {
    requireSlotExists(op.slotCode(), slotExists);
    ObjectNode existing = findNode(nodes, op.nodeId());
    switch (op.type()) {
      case ADD_WORKFLOW_NODE -> {
        if (existing != null) {
          throw new InvalidStructuralPatchException("이미 존재하는 node id입니다: " + op.nodeId());
        }
        ObjectNode node = nodes.addObject();
        node.put("id", op.nodeId());
        writeNodeFields(node, op);
        requireUserFacingPrompt(node, op.nodeType());
      }
      case UPDATE_WORKFLOW_NODE -> {
        if (existing == null) {
          throw new InvalidStructuralPatchException("수정할 node를 찾을 수 없습니다: " + op.nodeId());
        }
        writeNodeFields(existing, op);
        requireUserFacingPrompt(existing, op.nodeType());
      }
      default ->
          throw new InvalidStructuralPatchException("지원하지 않는 node operation입니다: " + op.type());
    }
  }

  private void writeNodeFields(ObjectNode node, WorkflowNode op) {
    node.put("type", op.nodeType());
    if (op.slotCode() != null) {
      node.put("slotCode", op.slotCode());
    }
    if (op.prompt() != null) {
      node.put("prompt", op.prompt());
    }
  }

  private void requireUserFacingPrompt(ObjectNode node, String nodeType) {
    if (!USER_FACING_NODE_TYPES.contains(nodeType)) {
      return;
    }
    JsonNode prompt = node.get("prompt");
    if (prompt == null || prompt.asText("").isBlank()) {
      throw new InvalidStructuralPatchException(
          nodeType + " node는 비어있지 않은 prompt가 필요합니다: " + node.path("id").asText());
    }
  }

  private void requireSlotExists(String slotCode, Predicate<String> slotExists) {
    if (slotCode != null && !slotExists.test(slotCode)) {
      throw new InvalidStructuralPatchException("존재하지 않는 slotCode를 참조합니다: " + slotCode);
    }
  }

  private void applyTransition(ArrayNode edges, WorkflowTransition op) {
    switch (op.type()) {
      case ADD_TRANSITION -> {
        String edgeId = "e_" + op.from() + "_" + op.to();
        if (findEdgeIndexById(edges, edgeId) >= 0
            || findEdgeIndex(edges, op.from(), op.to()) >= 0) {
          throw new InvalidStructuralPatchException(
              "이미 존재하는 transition입니다: " + op.from() + " -> " + op.to());
        }
        ObjectNode edge = edges.addObject();
        edge.put("id", edgeId);
        edge.put("from", op.from());
        edge.put("to", op.to());
        if (op.condition() != null) {
          edge.set("condition", readCondition(op.condition()));
        }
      }
      case UPDATE_TRANSITION -> {
        ObjectNode edge = requireEdge(edges, op);
        if (op.condition() != null) {
          edge.set("condition", readCondition(op.condition()));
        }
      }
      case REMOVE_TRANSITION -> {
        int index = findEdgeIndex(edges, op.from(), op.to());
        if (index < 0) {
          throw transitionNotFound(op);
        }
        edges.remove(index);
      }
      default ->
          throw new InvalidStructuralPatchException(
              "지원하지 않는 transition operation입니다: " + op.type());
    }
  }

  private ObjectNode requireEdge(ArrayNode edges, WorkflowTransition op) {
    int index = findEdgeIndex(edges, op.from(), op.to());
    if (index < 0) {
      throw transitionNotFound(op);
    }
    return (ObjectNode) edges.get(index);
  }

  private InvalidStructuralPatchException transitionNotFound(WorkflowTransition op) {
    return new InvalidStructuralPatchException(
        "수정/삭제할 transition을 찾을 수 없습니다: " + op.from() + " -> " + op.to());
  }

  private JsonNode readCondition(String condition) {
    JsonNode parsed;
    try {
      parsed = objectMapper.readTree(condition);
    } catch (JsonProcessingException e) {
      throw new InvalidStructuralPatchException("transition condition이 유효한 JSON이 아닙니다.");
    }
    if (!parsed.isObject()) {
      throw new InvalidStructuralPatchException("transition condition은 JSON object여야 합니다.");
    }
    return parsed;
  }

  private ObjectNode readObject(String graphJson) {
    JsonNode root;
    try {
      root = objectMapper.readTree(graphJson);
    } catch (JsonProcessingException e) {
      throw new InvalidStructuralPatchException("workflow graphJson을 파싱할 수 없습니다.");
    }
    if (root == null || !root.isObject()) {
      throw new InvalidStructuralPatchException("workflow graphJson은 JSON object여야 합니다.");
    }
    return (ObjectNode) root;
  }

  private ArrayNode arrayChild(ObjectNode root, String field) {
    JsonNode child = root.get(field);
    if (child != null && child.isArray()) {
      return (ArrayNode) child;
    }
    return root.putArray(field);
  }

  private ObjectNode findNode(ArrayNode nodes, String nodeId) {
    for (JsonNode node : nodes) {
      if (node.isObject() && nodeId.equals(node.path("id").asText(null))) {
        return (ObjectNode) node;
      }
    }
    return null;
  }

  private int findEdgeIndex(ArrayNode edges, String from, String to) {
    for (int i = 0; i < edges.size(); i++) {
      JsonNode edge = edges.get(i);
      if (from.equals(edge.path("from").asText(null)) && to.equals(edge.path("to").asText(null))) {
        return i;
      }
    }
    return -1;
  }

  private int findEdgeIndexById(ArrayNode edges, String edgeId) {
    for (int i = 0; i < edges.size(); i++) {
      if (edgeId.equals(edges.get(i).path("id").asText(null))) {
        return i;
      }
    }
    return -1;
  }

  private void verifyNoDuplicateNodeIds(ArrayNode nodes) {
    Set<String> seen = new HashSet<>();
    for (JsonNode node : nodes) {
      String id = node.path("id").asText(null);
      if (id != null && !seen.add(id)) {
        throw new InvalidStructuralPatchException("중복된 node id가 존재합니다: " + id);
      }
    }
  }

  private String write(ObjectNode root) {
    try {
      return objectMapper.writeValueAsString(root);
    } catch (JsonProcessingException e) {
      throw new InvalidStructuralPatchException("workflow graphJson 직렬화에 실패했습니다.");
    }
  }
}
