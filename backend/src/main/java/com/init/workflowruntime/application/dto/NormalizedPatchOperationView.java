package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.StructuralPatchOperation;

/**
 * 단일 구조 패치 operation을 프론트 리뷰 화면이 바로 렌더할 수 있도록 평탄화(flat)한 read-side view. 제안된("after") 값만 노출하며, 해당
 * operation 종류에 무관한 필드는 null이다. {@code targetComplete}는 target 식별 정보가 충분한지를 백엔드에서 계산한 결과다.
 */
public record NormalizedPatchOperationView(
    String operationType,
    String kind,
    String targetCategory,
    String targetCode,
    Long targetId,
    String value,
    String nodeId,
    String nodeType,
    String slotCode,
    String prompt,
    String from,
    String to,
    String condition,
    String reason,
    boolean targetComplete) {

  public static NormalizedPatchOperationView from(StructuralPatchOperation op) {
    return switch (op) {
      case StructuralPatchOperation.ElementAttribute element -> fromElement(element);
      case StructuralPatchOperation.WorkflowNode node -> fromWorkflowNode(node);
      case StructuralPatchOperation.WorkflowTransition transition -> fromTransition(transition);
    };
  }

  private static NormalizedPatchOperationView fromElement(
      StructuralPatchOperation.ElementAttribute element) {
    boolean targetComplete =
        element.category() != null
            && (!isBlank(element.targetCode()) || element.targetId() != null);
    return new NormalizedPatchOperationView(
        element.type().name(),
        "ELEMENT",
        element.category().name(),
        element.targetCode(),
        element.targetId(),
        element.value(),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        element.reason(),
        targetComplete);
  }

  private static NormalizedPatchOperationView fromWorkflowNode(
      StructuralPatchOperation.WorkflowNode node) {
    boolean targetComplete =
        (!isBlank(node.workflowCode()) || node.workflowDefinitionId() != null)
            && !isBlank(node.nodeId());
    return new NormalizedPatchOperationView(
        node.type().name(),
        "WORKFLOW_NODE",
        "WORKFLOW",
        node.workflowCode(),
        null,
        null,
        node.nodeId(),
        node.nodeType(),
        node.slotCode(),
        node.prompt(),
        null,
        null,
        null,
        node.reason(),
        targetComplete);
  }

  private static NormalizedPatchOperationView fromTransition(
      StructuralPatchOperation.WorkflowTransition transition) {
    boolean targetComplete =
        (!isBlank(transition.workflowCode()) || transition.workflowDefinitionId() != null)
            && !isBlank(transition.from())
            && !isBlank(transition.to());
    return new NormalizedPatchOperationView(
        transition.type().name(),
        "WORKFLOW_TRANSITION",
        "WORKFLOW",
        transition.workflowCode(),
        null,
        null,
        null,
        null,
        null,
        null,
        transition.from(),
        transition.to(),
        transition.condition(),
        transition.reason(),
        targetComplete);
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }
}
