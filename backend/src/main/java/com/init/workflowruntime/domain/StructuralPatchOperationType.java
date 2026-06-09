package com.init.workflowruntime.domain;

import java.util.Optional;

/**
 * {@code simulation-structural-patch.v1} 에서 지원하는 MVP operation 집합. 각 상수는 어떤 record 형태로 파싱되는지(kind),
 * 어떤 Domain Pack 요소를 가리키는지(category), 그리고 ELEMENT operation의 JSON code/value 필드명을 보유한다.
 */
public enum StructuralPatchOperationType {
  UPDATE_INTENT_DESCRIPTION(
      Kind.ELEMENT, StructuralPatchTargetCategory.INTENT, "intentCode", "description"),
  ADD_INTENT_EXAMPLE(Kind.ELEMENT, StructuralPatchTargetCategory.INTENT, "intentCode", "example"),
  UPDATE_SLOT_DESCRIPTION(
      Kind.ELEMENT, StructuralPatchTargetCategory.SLOT, "slotCode", "description"),
  MARK_SLOT_REQUIRED(Kind.ELEMENT, StructuralPatchTargetCategory.SLOT, "slotCode", null),
  UPDATE_SLOT_VALIDATION(
      Kind.ELEMENT, StructuralPatchTargetCategory.SLOT, "slotCode", "validation"),
  UPDATE_POLICY_CONDITION(
      Kind.ELEMENT, StructuralPatchTargetCategory.POLICY, "policyCode", "condition"),
  UPDATE_RISK_TRIGGER(Kind.ELEMENT, StructuralPatchTargetCategory.RISK, "riskCode", "trigger"),
  UPDATE_RESPONSE_COPY(
      Kind.ELEMENT, StructuralPatchTargetCategory.RESPONSE, "responseCode", "copy"),
  ADD_WORKFLOW_NODE(Kind.WORKFLOW_NODE, StructuralPatchTargetCategory.WORKFLOW, null, null),
  UPDATE_WORKFLOW_NODE(Kind.WORKFLOW_NODE, StructuralPatchTargetCategory.WORKFLOW, null, null),
  ADD_TRANSITION(Kind.WORKFLOW_TRANSITION, StructuralPatchTargetCategory.WORKFLOW, null, null),
  UPDATE_TRANSITION(Kind.WORKFLOW_TRANSITION, StructuralPatchTargetCategory.WORKFLOW, null, null),
  REMOVE_TRANSITION(Kind.WORKFLOW_TRANSITION, StructuralPatchTargetCategory.WORKFLOW, null, null);

  public enum Kind {
    ELEMENT,
    WORKFLOW_NODE,
    WORKFLOW_TRANSITION
  }

  private final Kind kind;
  private final StructuralPatchTargetCategory category;
  private final String codeFieldName;
  private final String valueFieldName;

  StructuralPatchOperationType(
      Kind kind,
      StructuralPatchTargetCategory category,
      String codeFieldName,
      String valueFieldName) {
    this.kind = kind;
    this.category = category;
    this.codeFieldName = codeFieldName;
    this.valueFieldName = valueFieldName;
  }

  public Kind getKind() {
    return kind;
  }

  public StructuralPatchTargetCategory getCategory() {
    return category;
  }

  /** ELEMENT operation에서 target code를 담는 JSON 필드명. workflow operation이면 null. */
  public String getCodeFieldName() {
    return codeFieldName;
  }

  /** ELEMENT operation에서 변경 값을 담는 JSON 필드명. 값이 없는 operation이면 null. */
  public String getValueFieldName() {
    return valueFieldName;
  }

  public boolean requiresValue() {
    return kind == Kind.ELEMENT && valueFieldName != null;
  }

  /** 미지원 operation은 비워서 반환해 fail-closed 검증을 유도한다. */
  public static Optional<StructuralPatchOperationType> from(String raw) {
    if (raw == null) {
      return Optional.empty();
    }
    for (StructuralPatchOperationType type : values()) {
      if (type.name().equals(raw)) {
        return Optional.of(type);
      }
    }
    return Optional.empty();
  }
}
