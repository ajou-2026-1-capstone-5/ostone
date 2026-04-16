package com.init.domainpack.application;

import java.util.List;

public record CreateDomainPackDraftCommand(
    Long workspaceId,
    Long packId,
    Long userId,
    Long sourcePipelineJobId,
    String summaryJson,
    List<IntentDraft> intents,
    List<SlotDraft> slots,
    List<IntentSlotBindingDraft> intentSlotBindings,
    List<PolicyDraft> policies,
    List<RiskDraft> risks,
    List<WorkflowDraft> workflows,
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

  public record IntentSlotBindingDraft(
      String intentCode,
      String slotCode,
      Boolean isRequired,
      Integer collectionOrder,
      String promptHint,
      String conditionJson) {}

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
      String initialState,
      String terminalStatesJson,
      String evidenceJson,
      String metaJson) {}

  public record IntentWorkflowBindingDraft(
      String intentCode, String workflowCode, Boolean isPrimary, String routeConditionJson) {}
}
