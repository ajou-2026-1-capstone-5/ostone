package com.init.pipelinejob.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.application.exception.CallbackTargetVersionNotFoundException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyFinalizedException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackNotAllowedException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackTargetMismatchException;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.PipelineArtifactRepository;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class ReceiveWorkflowDraftCallbackUseCase {

  private static final String WEBHOOK_TYPE = "WORKFLOW_DRAFT_CALLBACK";
  private static final String STAGE_NAME = "publish-candidate";
  private static final String ARTIFACT_TYPE = "WORKFLOW_DRAFT_PAYLOAD";

  private final PipelineJobRepository pipelineJobRepository;
  private final PipelineArtifactRepository pipelineArtifactRepository;
  private final AddWorkflowDraftPort addWorkflowDraftPort;
  private final DomainPackVersionPort domainPackVersionPort;
  private final ObjectMapper objectMapper;
  private final PipelineJobCallbackSupportService callbackSupportService;

  public ReceiveWorkflowDraftCallbackUseCase(
      PipelineJobRepository pipelineJobRepository,
      PipelineArtifactRepository pipelineArtifactRepository,
      AddWorkflowDraftPort addWorkflowDraftPort,
      DomainPackVersionPort domainPackVersionPort,
      ObjectMapper objectMapper,
      PipelineJobCallbackSupportService callbackSupportService) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.pipelineArtifactRepository = pipelineArtifactRepository;
    this.addWorkflowDraftPort = addWorkflowDraftPort;
    this.domainPackVersionPort = domainPackVersionPort;
    this.objectMapper = objectMapper;
    this.callbackSupportService = callbackSupportService;
  }

  public ReceiveWorkflowDraftCallbackResult execute(ReceiveWorkflowDraftCallbackCommand command) {
    callbackSupportService.validateWebhookSecret(command.providedWebhookSecret());

    Optional<WebhookReceipt> existingReceipt =
        callbackSupportService.findReceipt(command.externalEventId());
    callbackSupportService.validateWebhookType(
        existingReceipt.orElse(null), command.externalEventId(), WEBHOOK_TYPE);
    if (callbackSupportService.isProcessed(existingReceipt.orElse(null))) {
      return ReceiveWorkflowDraftCallbackResult.duplicateIgnored(command.externalEventId());
    }

    PipelineJob job =
        pipelineJobRepository
            .findById(command.jobId())
            .orElseThrow(() -> new PipelineJobNotFoundException(command.jobId()));
    if (job.isFinalized()) {
      throw new PipelineJobAlreadyFinalizedException(command.jobId());
    }
    if (!job.canAcceptWorkflowDraftCallback()) {
      throw new PipelineJobCallbackNotAllowedException(
          command.jobId(), job.getStatus(), WEBHOOK_TYPE);
    }

    WebhookReceipt receipt =
        callbackSupportService.ensureReceivedReceipt(
            command.jobId(),
            command.externalEventId(),
            WEBHOOK_TYPE,
            command.requestHeadersJson(),
            command.requestBodyJson(),
            existingReceipt.orElse(null));
    callbackSupportService.validateWebhookType(receipt, command.externalEventId(), WEBHOOK_TYPE);
    if (callbackSupportService.isProcessed(receipt)) {
      return ReceiveWorkflowDraftCallbackResult.duplicateIgnored(command.externalEventId());
    }

    return callbackSupportService.executeInTransactionOrMarkFailure(
        command.jobId(), command.externalEventId(), () -> processCallback(command));
  }

  private ReceiveWorkflowDraftCallbackResult processCallback(
      ReceiveWorkflowDraftCallbackCommand command) {
    PipelineJob job =
        pipelineJobRepository
            .findById(command.jobId())
            .orElseThrow(() -> new PipelineJobNotFoundException(command.jobId()));
    if (job.isFinalized()) {
      throw new PipelineJobAlreadyFinalizedException(command.jobId());
    }
    if (!job.canAcceptWorkflowDraftCallback()) {
      throw new PipelineJobCallbackNotAllowedException(
          command.jobId(), job.getStatus(), WEBHOOK_TYPE);
    }
    Long domainPackId = validateTargetVersion(job, command.domainPackVersionId());

    OffsetDateTime now = callbackSupportService.now();
    pipelineArtifactRepository.save(
        PipelineArtifact.create(
            job.getId(), STAGE_NAME, ARTIFACT_TYPE, null, null, command.requestBodyJson(), now));

    AddWorkflowDraftPortResult workflowResult =
        addWorkflowDraftPort.execute(
            new AddWorkflowDraftPortCommand(
                command.domainPackVersionId(),
                command.slots(),
                command.policies(),
                command.risks(),
                command.workflows(),
                command.intentSlotBindings(),
                command.intentWorkflowBindings()));

    job.markSucceeded(
        domainPackId,
        buildSuccessSummaryJson(workflowResult, domainPackId, command.domainPackVersionId()),
        now);
    callbackSupportService.savePipelineJobOrThrowConflict(job, command.jobId());
    callbackSupportService.markReceiptProcessed(command.externalEventId(), now);

    return ReceiveWorkflowDraftCallbackResult.created(
        command.externalEventId(),
        domainPackId,
        command.domainPackVersionId(),
        workflowResult.addedSlotCount(),
        workflowResult.addedPolicyCount(),
        workflowResult.addedRiskCount(),
        workflowResult.addedWorkflowCount(),
        workflowResult.addedIntentSlotBindingCount(),
        workflowResult.addedIntentWorkflowBindingCount(),
        command.jobId());
  }

  private Long validateTargetVersion(PipelineJob job, Long domainPackVersionId) {
    Long versionDomainPackId =
        domainPackVersionPort
            .findDomainPackIdByVersionId(domainPackVersionId)
            .orElseThrow(() -> new CallbackTargetVersionNotFoundException(domainPackVersionId));
    if (!Objects.equals(job.getDomainPackId(), versionDomainPackId)) {
      throw new PipelineJobCallbackTargetMismatchException(
          job.getId(), job.getDomainPackId(), domainPackVersionId, versionDomainPackId);
    }
    if (!domainPackVersionPort.existsByDomainPackIdAndWorkspaceId(
        versionDomainPackId, job.getWorkspaceId())) {
      throw new PipelineJobCallbackTargetMismatchException(
          job.getId(), job.getDomainPackId(), domainPackVersionId, versionDomainPackId);
    }
    return versionDomainPackId;
  }

  private String buildSuccessSummaryJson(
      AddWorkflowDraftPortResult result, Long domainPackId, Long domainPackVersionId) {
    ObjectNode summary = objectMapper.createObjectNode();
    summary.put("domainPackId", domainPackId);
    summary.put("domainPackVersionId", domainPackVersionId);
    summary.put("addedSlotCount", result.addedSlotCount());
    summary.put("addedPolicyCount", result.addedPolicyCount());
    summary.put("addedRiskCount", result.addedRiskCount());
    summary.put("addedWorkflowCount", result.addedWorkflowCount());
    summary.put("addedIntentSlotBindingCount", result.addedIntentSlotBindingCount());
    summary.put("addedIntentWorkflowBindingCount", result.addedIntentWorkflowBindingCount());
    try {
      return objectMapper.writeValueAsString(summary);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Workflow callback 성공 요약 JSON 생성에 실패했습니다.", ex);
    }
  }
}
