package com.init.domainpack.application;

import java.util.List;
import java.util.Objects;

public record AddWorkflowDraftToVersionCommand(
    Long domainPackVersionId,
    List<SlotDraft> slots,
    List<PolicyDraft> policies,
    List<RiskDraft> risks,
    List<WorkflowDraft> workflows,
    List<IntentSlotBindingDraft> intentSlotBindings,
    List<IntentWorkflowBindingDraft> intentWorkflowBindings) {

  public AddWorkflowDraftToVersionCommand {
    domainPackVersionId = Objects.requireNonNull(domainPackVersionId, "domainPackVersionId");
    slots = immutableCopy(slots);
    policies = immutableCopy(policies);
    risks = immutableCopy(risks);
    workflows = immutableCopy(workflows);
    intentSlotBindings = immutableCopy(intentSlotBindings);
    intentWorkflowBindings = immutableCopy(intentWorkflowBindings);
  }

  private static <T> List<T> immutableCopy(List<T> values) {
    return values == null || values.isEmpty() ? List.of() : List.copyOf(values);
  }

  public record SlotDraft(
      String slotCode,
      String name,
      String description,
      String dataType,
      Boolean isSensitive,
      String validationRuleJson,
      String defaultValueJson,
      String metaJson) {}

  public record PolicyDraft(
      String policyCode,
      String name,
      String description,
      String severity,
      String conditionJson,
      String actionJson,
      String evidenceJson,
      String metaJson) {}

  public record RiskDraft(
      String riskCode,
      String name,
      String description,
      String riskLevel,
      String triggerConditionJson,
      String handlingActionJson,
      String evidenceJson,
      String metaJson) {}

  public record WorkflowDraft(
      String workflowCode,
      String name,
      String description,
      String graphJson,
      String evidenceJson,
      String metaJson) {}

  public record IntentSlotBindingDraft(
      String intentCode,
      String slotCode,
      Boolean isRequired,
      Integer collectionOrder,
      String promptHint,
      String conditionJson) {}

  public record IntentWorkflowBindingDraft(
      String intentCode, String workflowCode, Boolean isPrimary, String routeConditionJson) {}
}
