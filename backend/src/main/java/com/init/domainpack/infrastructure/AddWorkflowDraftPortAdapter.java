package com.init.domainpack.infrastructure;

import com.init.domainpack.application.AddWorkflowDraftToVersionCommand;
import com.init.domainpack.application.AddWorkflowDraftToVersionUseCase;
import com.init.pipelinejob.application.AddWorkflowDraftPort;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.IntentSlotBindingDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.IntentWorkflowBindingDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.PolicyDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.RiskDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.SlotDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.WorkflowDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortResult;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class AddWorkflowDraftPortAdapter implements AddWorkflowDraftPort {

  private final AddWorkflowDraftToVersionUseCase addWorkflowDraftToVersionUseCase;

  public AddWorkflowDraftPortAdapter(
      AddWorkflowDraftToVersionUseCase addWorkflowDraftToVersionUseCase) {
    this.addWorkflowDraftToVersionUseCase = addWorkflowDraftToVersionUseCase;
  }

  @Override
  public AddWorkflowDraftPortResult execute(AddWorkflowDraftPortCommand command) {
    var result = addWorkflowDraftToVersionUseCase.execute(toInternalCommand(command));
    return new AddWorkflowDraftPortResult(
        result.domainPackVersionId(),
        result.domainPackId(),
        result.addedSlotCount(),
        result.addedPolicyCount(),
        result.addedRiskCount(),
        result.addedWorkflowCount(),
        result.addedIntentSlotBindingCount(),
        result.addedIntentWorkflowBindingCount());
  }

  private AddWorkflowDraftToVersionCommand toInternalCommand(AddWorkflowDraftPortCommand command) {
    return new AddWorkflowDraftToVersionCommand(
        command.domainPackVersionId(),
        toSlotDrafts(command.slots()),
        toPolicyDrafts(command.policies()),
        toRiskDrafts(command.risks()),
        toWorkflowDrafts(command.workflows()),
        toIntentSlotBindingDrafts(command.intentSlotBindings()),
        toIntentWorkflowBindingDrafts(command.intentWorkflowBindings()));
  }

  private List<AddWorkflowDraftToVersionCommand.SlotDraft> toSlotDrafts(List<SlotDraft> slots) {
    return slots.stream()
        .map(
            s ->
                new AddWorkflowDraftToVersionCommand.SlotDraft(
                    s.slotCode(),
                    s.name(),
                    s.description(),
                    s.dataType(),
                    s.isSensitive(),
                    s.validationRuleJson(),
                    s.defaultValueJson(),
                    s.metaJson()))
        .toList();
  }

  private List<AddWorkflowDraftToVersionCommand.PolicyDraft> toPolicyDrafts(
      List<PolicyDraft> policies) {
    return policies.stream()
        .map(
            p ->
                new AddWorkflowDraftToVersionCommand.PolicyDraft(
                    p.policyCode(),
                    p.name(),
                    p.description(),
                    p.severity(),
                    p.conditionJson(),
                    p.actionJson(),
                    p.evidenceJson(),
                    p.metaJson()))
        .toList();
  }

  private List<AddWorkflowDraftToVersionCommand.RiskDraft> toRiskDrafts(List<RiskDraft> risks) {
    return risks.stream()
        .map(
            r ->
                new AddWorkflowDraftToVersionCommand.RiskDraft(
                    r.riskCode(),
                    r.name(),
                    r.description(),
                    r.riskLevel(),
                    r.triggerConditionJson(),
                    r.handlingActionJson(),
                    r.evidenceJson(),
                    r.metaJson()))
        .toList();
  }

  private List<AddWorkflowDraftToVersionCommand.WorkflowDraft> toWorkflowDrafts(
      List<WorkflowDraft> workflows) {
    return workflows.stream()
        .map(
            w ->
                new AddWorkflowDraftToVersionCommand.WorkflowDraft(
                    w.workflowCode(),
                    w.name(),
                    w.description(),
                    w.graphJson(),
                    w.evidenceJson(),
                    w.metaJson()))
        .toList();
  }

  private List<AddWorkflowDraftToVersionCommand.IntentSlotBindingDraft> toIntentSlotBindingDrafts(
      List<IntentSlotBindingDraft> bindings) {
    return bindings.stream()
        .map(
            b ->
                new AddWorkflowDraftToVersionCommand.IntentSlotBindingDraft(
                    b.intentCode(),
                    b.slotCode(),
                    b.isRequired(),
                    b.collectionOrder(),
                    b.promptHint(),
                    b.conditionJson()))
        .toList();
  }

  private List<AddWorkflowDraftToVersionCommand.IntentWorkflowBindingDraft>
      toIntentWorkflowBindingDrafts(List<IntentWorkflowBindingDraft> bindings) {
    return bindings.stream()
        .map(
            b ->
                new AddWorkflowDraftToVersionCommand.IntentWorkflowBindingDraft(
                    b.intentCode(), b.workflowCode(), b.isPrimary(), b.routeConditionJson()))
        .toList();
  }
}
