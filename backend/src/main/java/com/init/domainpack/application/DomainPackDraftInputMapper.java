package com.init.domainpack.application;

import static com.init.domainpack.application.DomainPackDraftPersistenceSupport.safeList;

import java.util.List;

final class DomainPackDraftInputMapper {

  private DomainPackDraftInputMapper() {}

  static DraftComponentsInput fromCreateCommand(CreateDomainPackDraftCommand command) {
    return new DraftComponentsInput(
        toSlotInputs(command.slots()),
        toPolicyInputs(command.policies()),
        toRiskInputs(command.risks()),
        toWorkflowInputs(command.workflows()),
        toIntentSlotBindingInputs(command.intentSlotBindings()));
  }

  static DraftComponentsInput fromWorkflowCallback(
      List<AddWorkflowDraftToVersionCommand.SlotDraft> slots,
      List<AddWorkflowDraftToVersionCommand.PolicyDraft> policies,
      List<AddWorkflowDraftToVersionCommand.RiskDraft> risks,
      List<AddWorkflowDraftToVersionCommand.WorkflowDraft> workflows,
      List<AddWorkflowDraftToVersionCommand.IntentSlotBindingDraft> intentSlotBindings) {
    return new DraftComponentsInput(
        toSlotInputsFromWorkflowCallback(slots),
        toPolicyInputsFromWorkflowCallback(policies),
        toRiskInputsFromWorkflowCallback(risks),
        toWorkflowInputsFromWorkflowCallback(workflows),
        toIntentSlotBindingInputsFromWorkflowCallback(intentSlotBindings));
  }

  private static List<SlotInput> toSlotInputs(List<CreateDomainPackDraftCommand.SlotDraft> slots) {
    return safeList(slots).stream()
        .map(
            slot ->
                new SlotInput(
                    slot.slotCode(),
                    slot.name(),
                    slot.description(),
                    slot.dataType(),
                    slot.isSensitive(),
                    slot.validationRuleJson(),
                    slot.defaultValueJson(),
                    slot.metaJson()))
        .toList();
  }

  private static List<SlotInput> toSlotInputsFromWorkflowCallback(
      List<AddWorkflowDraftToVersionCommand.SlotDraft> slots) {
    return safeList(slots).stream()
        .map(
            slot ->
                new SlotInput(
                    slot.slotCode(),
                    slot.name(),
                    slot.description(),
                    slot.dataType(),
                    slot.isSensitive(),
                    slot.validationRuleJson(),
                    slot.defaultValueJson(),
                    slot.metaJson()))
        .toList();
  }

  private static List<PolicyInput> toPolicyInputs(
      List<CreateDomainPackDraftCommand.PolicyDraft> policies) {
    return safeList(policies).stream()
        .map(
            policy ->
                new PolicyInput(
                    policy.policyCode(),
                    policy.name(),
                    policy.description(),
                    policy.severity(),
                    policy.conditionJson(),
                    policy.actionJson(),
                    policy.evidenceJson(),
                    policy.metaJson()))
        .toList();
  }

  private static List<PolicyInput> toPolicyInputsFromWorkflowCallback(
      List<AddWorkflowDraftToVersionCommand.PolicyDraft> policies) {
    return safeList(policies).stream()
        .map(
            policy ->
                new PolicyInput(
                    policy.policyCode(),
                    policy.name(),
                    policy.description(),
                    policy.severity(),
                    policy.conditionJson(),
                    policy.actionJson(),
                    policy.evidenceJson(),
                    policy.metaJson()))
        .toList();
  }

  private static List<RiskInput> toRiskInputs(List<CreateDomainPackDraftCommand.RiskDraft> risks) {
    return safeList(risks).stream()
        .map(
            risk ->
                new RiskInput(
                    risk.riskCode(),
                    risk.name(),
                    risk.description(),
                    risk.riskLevel(),
                    risk.triggerConditionJson(),
                    risk.handlingActionJson(),
                    risk.evidenceJson(),
                    risk.metaJson()))
        .toList();
  }

  private static List<RiskInput> toRiskInputsFromWorkflowCallback(
      List<AddWorkflowDraftToVersionCommand.RiskDraft> risks) {
    return safeList(risks).stream()
        .map(
            risk ->
                new RiskInput(
                    risk.riskCode(),
                    risk.name(),
                    risk.description(),
                    risk.riskLevel(),
                    risk.triggerConditionJson(),
                    risk.handlingActionJson(),
                    risk.evidenceJson(),
                    risk.metaJson()))
        .toList();
  }

  private static List<WorkflowInput> toWorkflowInputs(
      List<CreateDomainPackDraftCommand.WorkflowDraft> workflows) {
    return safeList(workflows).stream()
        .map(
            workflow ->
                new WorkflowInput(
                    workflow.workflowCode(),
                    workflow.name(),
                    workflow.description(),
                    workflow.graphJson(),
                    workflow.initialState(),
                    workflow.terminalStatesJson(),
                    workflow.evidenceJson(),
                    workflow.metaJson(),
                    workflow.intentCode(),
                    workflow.isPrimary(),
                    workflow.routeConditionJson()))
        .toList();
  }

  private static List<WorkflowInput> toWorkflowInputsFromWorkflowCallback(
      List<AddWorkflowDraftToVersionCommand.WorkflowDraft> workflows) {
    return safeList(workflows).stream()
        .map(
            workflow ->
                new WorkflowInput(
                    workflow.workflowCode(),
                    workflow.name(),
                    workflow.description(),
                    workflow.graphJson(),
                    null,
                    null,
                    workflow.evidenceJson(),
                    workflow.metaJson(),
                    workflow.intentCode(),
                    workflow.isPrimary(),
                    workflow.routeConditionJson()))
        .toList();
  }

  private static List<IntentSlotBindingInput> toIntentSlotBindingInputs(
      List<CreateDomainPackDraftCommand.IntentSlotBindingDraft> bindings) {
    return safeList(bindings).stream()
        .map(
            binding ->
                new IntentSlotBindingInput(
                    binding.intentCode(),
                    binding.slotCode(),
                    binding.isRequired(),
                    binding.collectionOrder(),
                    binding.promptHint(),
                    binding.conditionJson()))
        .toList();
  }

  private static List<IntentSlotBindingInput> toIntentSlotBindingInputsFromWorkflowCallback(
      List<AddWorkflowDraftToVersionCommand.IntentSlotBindingDraft> bindings) {
    return safeList(bindings).stream()
        .map(
            binding ->
                new IntentSlotBindingInput(
                    binding.intentCode(),
                    binding.slotCode(),
                    binding.isRequired(),
                    binding.collectionOrder(),
                    binding.promptHint(),
                    binding.conditionJson()))
        .toList();
  }
}
