package com.init.workflowruntime.domain;

/**
 * {@code simulation-structural-patch.v1} 의 단일 operation. 각 변형은 자신의 불변식(필수 target/필드)을 compact
 * constructor에서 검증하므로, 검증을 통과한 인스턴스는 항상 적용 가능한 형태를 보장한다.
 */
public sealed interface StructuralPatchOperation
    permits StructuralPatchOperation.ElementAttribute,
        StructuralPatchOperation.WorkflowNode,
        StructuralPatchOperation.WorkflowTransition {

  StructuralPatchOperationType type();

  String reason();

  /** intent/slot/policy/risk/response 요소의 단일 속성을 바꾸는 operation. */
  record ElementAttribute(
      StructuralPatchOperationType type,
      StructuralPatchTargetCategory category,
      String targetCode,
      Long targetId,
      String value,
      String reason)
      implements StructuralPatchOperation {

    public ElementAttribute {
      requireType(type);
      requireReason(reason);
      if (isBlank(targetCode) && targetId == null) {
        throw new InvalidStructuralPatchException(
            type + " operation은 " + type.getCodeFieldName() + " 또는 targetId가 필요합니다.");
      }
      if (type.requiresValue() && isBlank(value)) {
        throw new InvalidStructuralPatchException(
            type + " operation은 " + type.getValueFieldName() + " 값이 필요합니다.");
      }
      targetCode = normalize(targetCode);
      value = normalize(value);
      reason = reason.strip();
    }
  }

  /** workflow 그래프에 노드를 추가하거나 수정하는 operation. */
  record WorkflowNode(
      StructuralPatchOperationType type,
      String workflowCode,
      Long workflowDefinitionId,
      String nodeId,
      String nodeType,
      String slotCode,
      String prompt,
      String reason)
      implements StructuralPatchOperation {

    public WorkflowNode {
      requireType(type);
      requireReason(reason);
      requireWorkflowTarget(type, workflowCode, workflowDefinitionId);
      if (isBlank(nodeId)) {
        throw new InvalidStructuralPatchException(type + " operation은 nodeId가 필요합니다.");
      }
      if (isBlank(nodeType)) {
        throw new InvalidStructuralPatchException(type + " operation은 nodeType이 필요합니다.");
      }
      workflowCode = normalize(workflowCode);
      nodeId = nodeId.strip();
      nodeType = nodeType.strip();
      slotCode = normalize(slotCode);
      prompt = normalize(prompt);
      reason = reason.strip();
    }
  }

  /** workflow 그래프의 전이(transition)를 추가/수정/삭제하는 operation. */
  record WorkflowTransition(
      StructuralPatchOperationType type,
      String workflowCode,
      Long workflowDefinitionId,
      String from,
      String to,
      String condition,
      String reason)
      implements StructuralPatchOperation {

    public WorkflowTransition {
      requireType(type);
      requireReason(reason);
      requireWorkflowTarget(type, workflowCode, workflowDefinitionId);
      if (isBlank(from)) {
        throw new InvalidStructuralPatchException(type + " operation은 from이 필요합니다.");
      }
      if (isBlank(to)) {
        throw new InvalidStructuralPatchException(type + " operation은 to가 필요합니다.");
      }
      workflowCode = normalize(workflowCode);
      from = from.strip();
      to = to.strip();
      condition = normalize(condition);
      reason = reason.strip();
    }
  }

  private static void requireType(StructuralPatchOperationType type) {
    if (type == null) {
      throw new InvalidStructuralPatchException("operation type은 필수입니다.");
    }
  }

  private static void requireReason(String reason) {
    if (isBlank(reason)) {
      throw new InvalidStructuralPatchException("operation reason은 필수입니다.");
    }
  }

  private static void requireWorkflowTarget(
      StructuralPatchOperationType type, String workflowCode, Long workflowDefinitionId) {
    if (isBlank(workflowCode) && workflowDefinitionId == null) {
      throw new InvalidStructuralPatchException(
          type + " operation은 workflowCode 또는 workflowDefinitionId가 필요합니다.");
    }
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private static String normalize(String value) {
    return value == null || value.isBlank() ? null : value.strip();
  }
}
