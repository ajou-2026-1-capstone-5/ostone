package com.init.domainpack.application;

import java.util.List;

public record AddWorkflowDraftToVersionCommand(
    Long domainPackVersionId,
    List<SlotDraft> slots,
    List<PolicyDraft> policies,
    List<RiskDraft> risks,
    List<WorkflowDraft> workflows,
    List<IntentSlotBindingDraft> intentSlotBindings,
    List<IntentWorkflowBindingDraft> intentWorkflowBindings) {

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
