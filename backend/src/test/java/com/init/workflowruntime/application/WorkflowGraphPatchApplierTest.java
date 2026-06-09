package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.domain.InvalidStructuralPatchException;
import com.init.workflowruntime.domain.StructuralPatchOperation;
import com.init.workflowruntime.domain.StructuralPatchOperationType;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("WorkflowGraphPatchApplier")
class WorkflowGraphPatchApplierTest {

  private static final String BASE_GRAPH =
      """
      {
        "direction": "LR",
        "nodes": [
          {"id": "start", "type": "START", "label": "시작"},
          {"id": "end", "type": "TERMINAL"}
        ],
        "edges": [
          {"id": "e1", "from": "start", "to": "end", "condition": {"type": "always"}}
        ]
      }
      """;

  private final ObjectMapper objectMapper = new ObjectMapper();
  private final WorkflowGraphPatchApplier applier = new WorkflowGraphPatchApplier(objectMapper);
  private final Predicate<String> anySlotExists = code -> true;

  @Test
  @DisplayName("ADD_WORKFLOW_NODE는 node를 추가하고 기존 node 속성을 보존한다")
  void should_addNodeAndPreserveExistingFields() throws Exception {
    StructuralPatchOperation op =
        new StructuralPatchOperation.WorkflowNode(
            StructuralPatchOperationType.ADD_WORKFLOW_NODE,
            "wf",
            null,
            "answer_pickup",
            "ANSWER",
            null,
            "픽업 일자를 알려주세요",
            "reason");

    JsonNode result = parse(applier.apply(BASE_GRAPH, List.of(op), anySlotExists));

    assertThat(nodeById(result, "answer_pickup").path("prompt").asText()).isEqualTo("픽업 일자를 알려주세요");
    assertThat(nodeById(result, "start").path("label").asText()).isEqualTo("시작");
  }

  @Test
  @DisplayName("ADD_WORKFLOW_NODE는 이미 존재하는 node id를 거절한다")
  void should_rejectDuplicateNodeOnAdd() {
    StructuralPatchOperation op =
        new StructuralPatchOperation.WorkflowNode(
            StructuralPatchOperationType.ADD_WORKFLOW_NODE,
            "wf",
            null,
            "start",
            "ANSWER",
            null,
            "text",
            "reason");

    assertThatThrownBy(() -> applier.apply(BASE_GRAPH, List.of(op), anySlotExists))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("이미 존재하는 node id");
  }

  @Test
  @DisplayName("user-facing node는 prompt가 비어 있으면 거절한다")
  void should_rejectUserFacingNodeWithoutPrompt() {
    StructuralPatchOperation op =
        new StructuralPatchOperation.WorkflowNode(
            StructuralPatchOperationType.ADD_WORKFLOW_NODE,
            "wf",
            null,
            "answer_x",
            "ANSWER",
            null,
            null,
            "reason");

    assertThatThrownBy(() -> applier.apply(BASE_GRAPH, List.of(op), anySlotExists))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("prompt");
  }

  @Test
  @DisplayName("존재하지 않는 slotCode를 참조하는 node는 거절한다")
  void should_rejectNodeWithUnknownSlotCode() {
    StructuralPatchOperation op =
        new StructuralPatchOperation.WorkflowNode(
            StructuralPatchOperationType.ADD_WORKFLOW_NODE,
            "wf",
            null,
            "ask_pickup",
            "ASK_SLOT",
            "pickupDate",
            null,
            "reason");

    assertThatThrownBy(() -> applier.apply(BASE_GRAPH, List.of(op), code -> false))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("slotCode");
  }

  @Test
  @DisplayName("UPDATE_WORKFLOW_NODE는 존재하는 node를 수정하고, 없으면 거절한다")
  void should_updateExistingNode_and_rejectMissing() throws Exception {
    StructuralPatchOperation update =
        new StructuralPatchOperation.WorkflowNode(
            StructuralPatchOperationType.UPDATE_WORKFLOW_NODE,
            "wf",
            null,
            "end",
            "TERMINAL",
            null,
            null,
            "reason");
    JsonNode result = parse(applier.apply(BASE_GRAPH, List.of(update), anySlotExists));
    assertThat(nodeById(result, "end").path("type").asText()).isEqualTo("TERMINAL");

    StructuralPatchOperation missing =
        new StructuralPatchOperation.WorkflowNode(
            StructuralPatchOperationType.UPDATE_WORKFLOW_NODE,
            "wf",
            null,
            "ghost",
            "ACTION",
            null,
            null,
            "reason");
    assertThatThrownBy(() -> applier.apply(BASE_GRAPH, List.of(missing), anySlotExists))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("찾을 수 없습니다");
  }

  @Test
  @DisplayName("ADD_TRANSITION은 deterministic id로 edge를 추가하고 condition을 보존한다")
  void should_addTransitionWithCondition() throws Exception {
    StructuralPatchOperation op =
        new StructuralPatchOperation.WorkflowTransition(
            StructuralPatchOperationType.ADD_TRANSITION,
            "wf",
            null,
            "end",
            "start",
            "{\"type\":\"default\"}",
            "reason");

    JsonNode result = parse(applier.apply(BASE_GRAPH, List.of(op), anySlotExists));
    JsonNode edge = edgeByFromTo(result, "end", "start");
    assertThat(edge.path("id").asText()).isEqualTo("e_end_start");
    assertThat(edge.path("condition").path("type").asText()).isEqualTo("default");
  }

  @Test
  @DisplayName("ADD_TRANSITION은 동일 from/to edge가 있으면 거절한다")
  void should_rejectDuplicateTransition() {
    StructuralPatchOperation op =
        new StructuralPatchOperation.WorkflowTransition(
            StructuralPatchOperationType.ADD_TRANSITION,
            "wf",
            null,
            "start",
            "end",
            null,
            "reason");

    assertThatThrownBy(() -> applier.apply(BASE_GRAPH, List.of(op), anySlotExists))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("이미 존재하는 transition");
  }

  @Test
  @DisplayName("ADD_TRANSITION은 잘못된 condition JSON을 거절한다")
  void should_rejectInvalidConditionJson() {
    StructuralPatchOperation op =
        new StructuralPatchOperation.WorkflowTransition(
            StructuralPatchOperationType.ADD_TRANSITION,
            "wf",
            null,
            "end",
            "start",
            "not-json",
            "reason");

    assertThatThrownBy(() -> applier.apply(BASE_GRAPH, List.of(op), anySlotExists))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("condition");
  }

  @Test
  @DisplayName("UPDATE_TRANSITION은 condition을 교체하고, 없으면 거절한다")
  void should_updateTransition_and_rejectMissing() throws Exception {
    StructuralPatchOperation update =
        new StructuralPatchOperation.WorkflowTransition(
            StructuralPatchOperationType.UPDATE_TRANSITION,
            "wf",
            null,
            "start",
            "end",
            "{\"type\":\"slot_present\",\"slotCode\":\"pickupDate\"}",
            "reason");
    JsonNode result = parse(applier.apply(BASE_GRAPH, List.of(update), anySlotExists));
    assertThat(edgeByFromTo(result, "start", "end").path("condition").path("type").asText())
        .isEqualTo("slot_present");

    StructuralPatchOperation missing =
        new StructuralPatchOperation.WorkflowTransition(
            StructuralPatchOperationType.UPDATE_TRANSITION, "wf", null, "x", "y", null, "reason");
    assertThatThrownBy(() -> applier.apply(BASE_GRAPH, List.of(missing), anySlotExists))
        .isInstanceOf(InvalidStructuralPatchException.class);
  }

  @Test
  @DisplayName("REMOVE_TRANSITION은 edge를 제거하고, 없으면 거절한다")
  void should_removeTransition_and_rejectMissing() throws Exception {
    StructuralPatchOperation remove =
        new StructuralPatchOperation.WorkflowTransition(
            StructuralPatchOperationType.REMOVE_TRANSITION,
            "wf",
            null,
            "start",
            "end",
            null,
            "reason");
    JsonNode result = parse(applier.apply(BASE_GRAPH, List.of(remove), anySlotExists));
    assertThat(result.path("edges")).isEmpty();

    StructuralPatchOperation missing =
        new StructuralPatchOperation.WorkflowTransition(
            StructuralPatchOperationType.REMOVE_TRANSITION, "wf", null, "x", "y", null, "reason");
    assertThatThrownBy(() -> applier.apply(BASE_GRAPH, List.of(missing), anySlotExists))
        .isInstanceOf(InvalidStructuralPatchException.class);
  }

  @Test
  @DisplayName("같은 patch에서 추가한 node를 이어지는 transition이 참조할 수 있다")
  void should_supportNodeThenTransitionInSamePatch() throws Exception {
    StructuralPatchOperation addNode =
        new StructuralPatchOperation.WorkflowNode(
            StructuralPatchOperationType.ADD_WORKFLOW_NODE,
            "wf",
            null,
            "answer_pickup",
            "ANSWER",
            null,
            "픽업 일자를 알려주세요",
            "reason");
    StructuralPatchOperation addEdge =
        new StructuralPatchOperation.WorkflowTransition(
            StructuralPatchOperationType.ADD_TRANSITION,
            "wf",
            null,
            "start",
            "answer_pickup",
            null,
            "reason");

    JsonNode result = parse(applier.apply(BASE_GRAPH, List.of(addNode, addEdge), anySlotExists));
    assertThat(nodeById(result, "answer_pickup").isMissingNode()).isFalse();
    assertThat(edgeByFromTo(result, "start", "answer_pickup").path("id").asText())
        .isEqualTo("e_start_answer_pickup");
  }

  @Test
  @DisplayName("applyResponseCopy는 일치하는 node가 있으면 copy를 설정하고 없으면 비어있다")
  void should_setResponseCopyWhenNodeMatches() throws Exception {
    Optional<String> patched = applier.applyResponseCopy(BASE_GRAPH, "end", "감사합니다");
    assertThat(patched).isPresent();
    assertThat(nodeById(parse(patched.get()), "end").path("copy").asText()).isEqualTo("감사합니다");

    assertThat(applier.applyResponseCopy(BASE_GRAPH, "ghost", "x")).isEmpty();
  }

  private JsonNode parse(String json) throws Exception {
    return objectMapper.readTree(json);
  }

  private JsonNode nodeById(JsonNode graph, String id) {
    for (JsonNode node : graph.path("nodes")) {
      if (id.equals(node.path("id").asText(null))) {
        return node;
      }
    }
    return objectMapper.missingNode();
  }

  private JsonNode edgeByFromTo(JsonNode graph, String from, String to) {
    for (JsonNode edge : graph.path("edges")) {
      if (from.equals(edge.path("from").asText(null)) && to.equals(edge.path("to").asText(null))) {
        return edge;
      }
    }
    return objectMapper.missingNode();
  }
}
