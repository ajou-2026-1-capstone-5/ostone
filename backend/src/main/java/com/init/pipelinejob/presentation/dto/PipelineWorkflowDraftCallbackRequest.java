package com.init.pipelinejob.presentation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public record PipelineWorkflowDraftCallbackRequest(
    @NotBlank(message = "externalEventId는 필수입니다.")
        @Size(max = 255, message = "externalEventId는 255자 이하여야 합니다.")
        String externalEventId,
    @NotNull(message = "domainPackVersionId는 필수입니다.")
        @Positive(message = "domainPackVersionId는 0보다 커야 합니다.")
        Long domainPackVersionId,
    @Size(max = 200, message = "slots는 200개 이하여야 합니다.") List<@Valid SlotDraftRequest> slots,
    @Size(max = 200, message = "policies는 200개 이하여야 합니다.") List<@Valid PolicyDraftRequest> policies,
    @Size(max = 200, message = "risks는 200개 이하여야 합니다.") List<@Valid RiskDraftRequest> risks,
    @Size(max = 50, message = "workflows는 50개 이하여야 합니다.")
        List<@Valid WorkflowDraftRequest> workflows,
    @Size(max = 1000, message = "intentSlotBindings는 1000개 이하여야 합니다.")
        List<@Valid IntentSlotBindingDraftRequest> intentSlotBindings,
    @Size(max = 1000, message = "intentWorkflowBindings는 1000개 이하여야 합니다.")
        List<@Valid IntentWorkflowBindingDraftRequest> intentWorkflowBindings) {

  public record SlotDraftRequest(
      @NotBlank(message = "slotCode는 필수입니다.") @Size(max = 100, message = "slotCode는 100자 이하여야 합니다.")
          String slotCode,
      @NotBlank(message = "slot name은 필수입니다.")
          @Size(max = 255, message = "slot name은 255자 이하여야 합니다.")
          String name,
      @Size(max = 1000, message = "description은 1000자 이하여야 합니다.") String description,
      @NotBlank(message = "dataType은 필수입니다.") @Size(max = 50, message = "dataType은 50자 이하여야 합니다.")
          String dataType,
      Boolean isSensitive,
      @Size(max = 5000, message = "validationRuleJson은 5000자 이하여야 합니다.") String validationRuleJson,
      @Size(max = 5000, message = "defaultValueJson은 5000자 이하여야 합니다.") String defaultValueJson,
      @Size(max = 5000, message = "metaJson은 5000자 이하여야 합니다.") String metaJson) {}

  public record PolicyDraftRequest(
      @NotBlank(message = "policyCode는 필수입니다.")
          @Size(max = 100, message = "policyCode는 100자 이하여야 합니다.")
          String policyCode,
      @NotBlank(message = "policy name은 필수입니다.")
          @Size(max = 255, message = "policy name은 255자 이하여야 합니다.")
          String name,
      @Size(max = 1000, message = "description은 1000자 이하여야 합니다.") String description,
      @Size(max = 50, message = "severity는 50자 이하여야 합니다.") String severity,
      @Size(max = 5000, message = "conditionJson은 5000자 이하여야 합니다.") String conditionJson,
      @Size(max = 5000, message = "actionJson은 5000자 이하여야 합니다.") String actionJson,
      @Size(max = 5000, message = "evidenceJson은 5000자 이하여야 합니다.") String evidenceJson,
      @Size(max = 5000, message = "metaJson은 5000자 이하여야 합니다.") String metaJson) {}

  public record RiskDraftRequest(
      @NotBlank(message = "riskCode는 필수입니다.") @Size(max = 100, message = "riskCode는 100자 이하여야 합니다.")
          String riskCode,
      @NotBlank(message = "risk name은 필수입니다.")
          @Size(max = 255, message = "risk name은 255자 이하여야 합니다.")
          String name,
      @Size(max = 1000, message = "description은 1000자 이하여야 합니다.") String description,
      @NotBlank(message = "riskLevel은 필수입니다.") @Size(max = 50, message = "riskLevel은 50자 이하여야 합니다.")
          String riskLevel,
      @Size(max = 5000, message = "triggerConditionJson은 5000자 이하여야 합니다.")
          String triggerConditionJson,
      @Size(max = 5000, message = "handlingActionJson은 5000자 이하여야 합니다.") String handlingActionJson,
      @Size(max = 5000, message = "evidenceJson은 5000자 이하여야 합니다.") String evidenceJson,
      @Size(max = 5000, message = "metaJson은 5000자 이하여야 합니다.") String metaJson) {}

  public record WorkflowDraftRequest(
      @NotBlank(message = "workflowCode는 필수입니다.")
          @Size(max = 100, message = "workflowCode는 100자 이하여야 합니다.")
          String workflowCode,
      @NotBlank(message = "workflow name은 필수입니다.")
          @Size(max = 255, message = "workflow name은 255자 이하여야 합니다.")
          String name,
      @Size(max = 1000, message = "description은 1000자 이하여야 합니다.") String description,
      @NotBlank(message = "graphJson은 필수입니다.")
          @Size(max = 20000, message = "graphJson은 20000자 이하여야 합니다.")
          String graphJson,
      @Size(max = 5000, message = "evidenceJson은 5000자 이하여야 합니다.") String evidenceJson,
      @Size(max = 5000, message = "metaJson은 5000자 이하여야 합니다.") String metaJson) {}

  public record IntentSlotBindingDraftRequest(
      @NotBlank(message = "intentCode는 필수입니다.")
          @Size(max = 100, message = "intentCode는 100자 이하여야 합니다.")
          String intentCode,
      @NotBlank(message = "slotCode는 필수입니다.") @Size(max = 100, message = "slotCode는 100자 이하여야 합니다.")
          String slotCode,
      Boolean isRequired,
      Integer collectionOrder,
      @Size(max = 1000, message = "promptHint는 1000자 이하여야 합니다.") String promptHint,
      @Size(max = 5000, message = "conditionJson은 5000자 이하여야 합니다.") String conditionJson) {}

  public record IntentWorkflowBindingDraftRequest(
      @NotBlank(message = "intentCode는 필수입니다.")
          @Size(max = 100, message = "intentCode는 100자 이하여야 합니다.")
          String intentCode,
      @NotBlank(message = "workflowCode는 필수입니다.")
          @Size(max = 100, message = "workflowCode는 100자 이하여야 합니다.")
          String workflowCode,
      Boolean isPrimary,
      @Size(max = 5000, message = "routeConditionJson은 5000자 이하여야 합니다.")
          String routeConditionJson) {}
}
