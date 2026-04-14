package com.init.domainpack.presentation;

import com.init.domainpack.application.CreateDomainPackDraftCommand;
import com.init.domainpack.application.CreateDomainPackDraftResult;
import com.init.domainpack.application.CreateDomainPackDraftUseCase;
import com.init.domainpack.presentation.dto.CreateDomainPackDraftRequest;
import com.init.domainpack.presentation.dto.CreateDomainPackDraftResponse;
import com.init.shared.presentation.AuthenticationUtils;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions")
public class CreateDomainPackDraftController {

  private final CreateDomainPackDraftUseCase useCase;

  public CreateDomainPackDraftController(CreateDomainPackDraftUseCase useCase) {
    this.useCase = useCase;
  }

  @PostMapping("/drafts")
  public ResponseEntity<CreateDomainPackDraftResponse> createDraft(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @Valid @RequestBody CreateDomainPackDraftRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    CreateDomainPackDraftResult result =
        useCase.execute(
            new CreateDomainPackDraftCommand(
                workspaceId,
                packId,
                userId,
                request.sourcePipelineJobId(),
                request.summaryJson(),
                safeList(request.intents()).stream()
                    .map(
                        intent ->
                            new CreateDomainPackDraftCommand.IntentDraft(
                                intent.intentCode(),
                                intent.name(),
                                intent.description(),
                                intent.taxonomyLevel(),
                                intent.parentIntentCode(),
                                intent.sourceClusterRef(),
                                intent.entryConditionJson(),
                                intent.evidenceJson(),
                                intent.metaJson()))
                    .toList(),
                safeList(request.slots()).stream()
                    .map(
                        slot ->
                            new CreateDomainPackDraftCommand.SlotDraft(
                                slot.slotCode(),
                                slot.name(),
                                slot.description(),
                                slot.dataType(),
                                slot.isSensitive(),
                                slot.validationRuleJson(),
                                slot.defaultValueJson(),
                                slot.metaJson()))
                    .toList(),
                safeList(request.intentSlotBindings()).stream()
                    .map(
                        binding ->
                            new CreateDomainPackDraftCommand.IntentSlotBindingDraft(
                                binding.intentCode(),
                                binding.slotCode(),
                                binding.isRequired(),
                                binding.collectionOrder(),
                                binding.promptHint(),
                                binding.conditionJson()))
                    .toList(),
                safeList(request.policies()).stream()
                    .map(
                        policy ->
                            new CreateDomainPackDraftCommand.PolicyDraft(
                                policy.policyCode(),
                                policy.name(),
                                policy.description(),
                                policy.severity(),
                                policy.conditionJson(),
                                policy.actionJson(),
                                policy.evidenceJson(),
                                policy.metaJson()))
                    .toList(),
                safeList(request.risks()).stream()
                    .map(
                        risk ->
                            new CreateDomainPackDraftCommand.RiskDraft(
                                risk.riskCode(),
                                risk.name(),
                                risk.description(),
                                risk.riskLevel(),
                                risk.triggerConditionJson(),
                                risk.handlingActionJson(),
                                risk.evidenceJson(),
                                risk.metaJson()))
                    .toList(),
                safeList(request.workflows()).stream()
                    .map(
                        workflow ->
                            new CreateDomainPackDraftCommand.WorkflowDraft(
                                workflow.workflowCode(),
                                workflow.name(),
                                workflow.description(),
                                workflow.graphJson(),
                                workflow.initialState(),
                                workflow.terminalStatesJson(),
                                workflow.evidenceJson(),
                                workflow.metaJson()))
                    .toList(),
                safeList(request.intentWorkflowBindings()).stream()
                    .map(
                        binding ->
                            new CreateDomainPackDraftCommand.IntentWorkflowBindingDraft(
                                binding.intentCode(),
                                binding.workflowCode(),
                                binding.isPrimary(),
                                binding.routeConditionJson()))
                    .toList()));

    return ResponseEntity.status(HttpStatus.CREATED)
        .body(
            new CreateDomainPackDraftResponse(
                result.versionId(),
                result.domainPackId(),
                result.versionNo(),
                result.lifecycleStatus(),
                result.sourcePipelineJobId(),
                result.intentCount(),
                result.slotCount(),
                result.policyCount(),
                result.riskCount(),
                result.workflowCount(),
                result.createdAt()));
  }

  private <T> List<T> safeList(List<T> values) {
    return values == null ? List.of() : values;
  }
}
