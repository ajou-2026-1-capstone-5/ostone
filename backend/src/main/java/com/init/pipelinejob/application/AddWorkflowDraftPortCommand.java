package com.init.pipelinejob.application;

import java.util.List;
import java.util.Objects;

public record AddWorkflowDraftPortCommand(
    Long domainPackVersionId,
    List<SlotDraft> slots,
    List<PolicyDraft> policies,
    List<RiskDraft> risks,
    List<WorkflowDraft> workflows,
    List<IntentSlotBindingDraft> intentSlotBindings,
    List<IntentWorkflowBindingDraft> intentWorkflowBindings) {

  public AddWorkflowDraftPortCommand {
    Objects.requireNonNull(domainPackVersionId, "domainPackVersionId");
    slots = slots != null ? slots : List.of();
    policies = policies != null ? policies : List.of();
    risks = risks != null ? risks : List.of();
    workflows = workflows != null ? workflows : List.of();
    intentSlotBindings = intentSlotBindings != null ? intentSlotBindings : List.of();
    intentWorkflowBindings = intentWorkflowBindings != null ? intentWorkflowBindings : List.of();
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
