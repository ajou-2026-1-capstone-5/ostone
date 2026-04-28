package com.init.pipelinejob.presentation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.AddWorkflowDraftToVersionCommand.IntentSlotBindingDraft;
import com.init.domainpack.application.AddWorkflowDraftToVersionCommand.IntentWorkflowBindingDraft;
import com.init.domainpack.application.AddWorkflowDraftToVersionCommand.PolicyDraft;
import com.init.domainpack.application.AddWorkflowDraftToVersionCommand.RiskDraft;
import com.init.domainpack.application.AddWorkflowDraftToVersionCommand.SlotDraft;
import com.init.domainpack.application.AddWorkflowDraftToVersionCommand.WorkflowDraft;
import com.init.pipelinejob.application.ReceiveWorkflowDraftCallbackCommand;
import com.init.pipelinejob.application.ReceiveWorkflowDraftCallbackResult;
import com.init.pipelinejob.application.ReceiveWorkflowDraftCallbackUseCase;
import com.init.pipelinejob.presentation.dto.PipelineWorkflowDraftCallbackRequest;
import com.init.pipelinejob.presentation.dto.PipelineWorkflowDraftCallbackResponse;
import com.init.shared.infrastructure.web.WebhookHeaderNames;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pipeline-jobs")
public class PipelineWorkflowDraftCallbackController {

  private final ReceiveWorkflowDraftCallbackUseCase workflowDraftCallbackUseCase;
  private final ObjectMapper objectMapper;

  public PipelineWorkflowDraftCallbackController(
      ReceiveWorkflowDraftCallbackUseCase workflowDraftCallbackUseCase, ObjectMapper objectMapper) {
    this.workflowDraftCallbackUseCase = workflowDraftCallbackUseCase;
    this.objectMapper = objectMapper;
  }

  @PostMapping("/{jobId}/callbacks/workflow-drafts")
  public ResponseEntity<PipelineWorkflowDraftCallbackResponse> receiveWorkflowDraftCallback(
      @PathVariable Long jobId,
      @RequestHeader(value = WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, required = false)
          String webhookSecret,
      @Valid @RequestBody PipelineWorkflowDraftCallbackRequest request,
      HttpServletRequest httpServletRequest) {
    ReceiveWorkflowDraftCallbackResult result =
        workflowDraftCallbackUseCase.execute(
            new ReceiveWorkflowDraftCallbackCommand(
                jobId,
                webhookSecret,
                request.externalEventId(),
                request.domainPackVersionId(),
                toSlotDrafts(request.slots()),
                toPolicyDrafts(request.policies()),
                toRiskDrafts(request.risks()),
                toWorkflowDrafts(request.workflows()),
                toIntentSlotBindingDrafts(request.intentSlotBindings()),
                toIntentWorkflowBindingDrafts(request.intentWorkflowBindings()),
                objectMapper
                    .valueToTree(WebhookRequestHeaders.extractMasked(httpServletRequest))
                    .toString(),
                objectMapper.valueToTree(request).toString()));

    HttpStatus status =
        "DUPLICATE_IGNORED".equals(result.status()) ? HttpStatus.OK : HttpStatus.CREATED;
    return ResponseEntity.status(status)
        .body(
            new PipelineWorkflowDraftCallbackResponse(
                result.status(),
                result.externalEventId(),
                result.domainPackId(),
                result.domainPackVersionId(),
                result.addedSlotCount(),
                result.addedPolicyCount(),
                result.addedRiskCount(),
                result.addedWorkflowCount(),
                result.addedIntentSlotBindingCount(),
                result.addedIntentWorkflowBindingCount(),
                result.sourcePipelineJobId()));
  }

  private List<SlotDraft> toSlotDrafts(
      List<PipelineWorkflowDraftCallbackRequest.SlotDraftRequest> slots) {
    return safeList(slots).stream()
        .map(
            slot ->
                new SlotDraft(
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

  private List<PolicyDraft> toPolicyDrafts(
      List<PipelineWorkflowDraftCallbackRequest.PolicyDraftRequest> policies) {
    return safeList(policies).stream()
        .map(
            policy ->
                new PolicyDraft(
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

  private List<RiskDraft> toRiskDrafts(
      List<PipelineWorkflowDraftCallbackRequest.RiskDraftRequest> risks) {
    return safeList(risks).stream()
        .map(
            risk ->
                new RiskDraft(
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

  private List<WorkflowDraft> toWorkflowDrafts(
      List<PipelineWorkflowDraftCallbackRequest.WorkflowDraftRequest> workflows) {
    return safeList(workflows).stream()
        .map(
            workflow ->
                new WorkflowDraft(
                    workflow.workflowCode(),
                    workflow.name(),
                    workflow.description(),
                    workflow.graphJson(),
                    workflow.evidenceJson(),
                    workflow.metaJson()))
        .toList();
  }

  private List<IntentSlotBindingDraft> toIntentSlotBindingDrafts(
      List<PipelineWorkflowDraftCallbackRequest.IntentSlotBindingDraftRequest> bindings) {
    return safeList(bindings).stream()
        .map(
            binding ->
                new IntentSlotBindingDraft(
                    binding.intentCode(),
                    binding.slotCode(),
                    binding.isRequired(),
                    binding.collectionOrder(),
                    binding.promptHint(),
                    binding.conditionJson()))
        .toList();
  }

  private List<IntentWorkflowBindingDraft> toIntentWorkflowBindingDrafts(
      List<PipelineWorkflowDraftCallbackRequest.IntentWorkflowBindingDraftRequest> bindings) {
    return safeList(bindings).stream()
        .map(
            binding ->
                new IntentWorkflowBindingDraft(
                    binding.intentCode(),
                    binding.workflowCode(),
                    binding.isPrimary(),
                    binding.routeConditionJson()))
        .toList();
  }

  private <T> List<T> safeList(List<T> list) {
    return list == null ? List.of() : list;
  }
}
