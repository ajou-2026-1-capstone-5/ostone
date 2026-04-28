package com.init.pipelinejob.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.application.CreateDomainPackDraftFromPipelineCommand;
import com.init.domainpack.application.CreateDomainPackDraftFromPipelineResult;
import com.init.domainpack.application.CreateDomainPackDraftFromPipelineUseCase;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyFinalizedException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackNotAllowedException;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.PipelineArtifactRepository;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class ReceiveDomainPackDraftCallbackUseCase {

  private static final String WEBHOOK_TYPE = "DOMAIN_PACK_DRAFT_CALLBACK";
  private static final String STAGE_NAME = "publish-candidate";
  private static final String ARTIFACT_TYPE = "DOMAIN_PACK_DRAFT_PAYLOAD";

  private final PipelineJobRepository pipelineJobRepository;
  private final PipelineArtifactRepository pipelineArtifactRepository;
  private final CreateDomainPackDraftFromPipelineUseCase createDomainPackDraftFromPipelineUseCase;
  private final ObjectMapper objectMapper;
  private final PipelineJobCallbackSupportService callbackSupportService;

  public ReceiveDomainPackDraftCallbackUseCase(
      PipelineJobRepository pipelineJobRepository,
      PipelineArtifactRepository pipelineArtifactRepository,
      CreateDomainPackDraftFromPipelineUseCase createDomainPackDraftFromPipelineUseCase,
      ObjectMapper objectMapper,
      PipelineJobCallbackSupportService callbackSupportService) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.pipelineArtifactRepository = pipelineArtifactRepository;
    this.createDomainPackDraftFromPipelineUseCase = createDomainPackDraftFromPipelineUseCase;
    this.objectMapper = objectMapper;
    this.callbackSupportService = callbackSupportService;
  }

  public ReceiveDomainPackDraftCallbackResult execute(
      ReceiveDomainPackDraftCallbackCommand command) {
    callbackSupportService.validateWebhookSecret(command.providedWebhookSecret());

    Optional<WebhookReceipt> existingReceipt =
        callbackSupportService.findReceipt(command.externalEventId());
    callbackSupportService.validateWebhookType(
        existingReceipt.orElse(null), command.externalEventId(), WEBHOOK_TYPE);
    if (callbackSupportService.isProcessed(existingReceipt.orElse(null))) {
      return ReceiveDomainPackDraftCallbackResult.duplicateIgnored(command.externalEventId());
    }

    PipelineJob job =
        pipelineJobRepository
            .findById(command.jobId())
            .orElseThrow(() -> new PipelineJobNotFoundException(command.jobId()));
    if (job.isFinalized()) {
      throw new PipelineJobAlreadyFinalizedException(command.jobId());
    }
    if (!job.canAcceptDomainPackDraftCallback()) {
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
      return ReceiveDomainPackDraftCallbackResult.duplicateIgnored(command.externalEventId());
    }

    try {
      return callbackSupportService.executeInTransaction(() -> processCallback(command));
    } catch (RuntimeException ex) {
      try {
        callbackSupportService.markFailure(command.jobId(), command.externalEventId(), ex);
      } catch (RuntimeException markFailureException) {
        ex.addSuppressed(markFailureException);
      }
      throw ex;
    }
  }

  private ReceiveDomainPackDraftCallbackResult processCallback(
      ReceiveDomainPackDraftCallbackCommand command) {
    PipelineJob job =
        pipelineJobRepository
            .findById(command.jobId())
            .orElseThrow(() -> new PipelineJobNotFoundException(command.jobId()));
    if (job.isFinalized()) {
      throw new PipelineJobAlreadyFinalizedException(command.jobId());
    }
    if (!job.canAcceptDomainPackDraftCallback()) {
      throw new PipelineJobCallbackNotAllowedException(
          command.jobId(), job.getStatus(), WEBHOOK_TYPE);
    }

    OffsetDateTime now = callbackSupportService.now();
    pipelineArtifactRepository.save(
        PipelineArtifact.create(
            job.getId(), STAGE_NAME, ARTIFACT_TYPE, null, null, command.requestBodyJson(), now));

    CreateDomainPackDraftFromPipelineResult draftResult =
        createDomainPackDraftFromPipelineUseCase.execute(
            new CreateDomainPackDraftFromPipelineCommand(
                job.getWorkspaceId(),
                command.packKey(),
                command.packName(),
                command.jobId(),
                command.summaryJson()));

    job.markAwaitingIntentCallback(
        draftResult.domainPackId(), buildIntermediateSummaryJson(draftResult));
    callbackSupportService.savePipelineJobOrThrowConflict(job, command.jobId());
    callbackSupportService.markReceiptProcessed(command.externalEventId(), now);

    return ReceiveDomainPackDraftCallbackResult.created(
        command.externalEventId(),
        draftResult.domainPackId(),
        draftResult.domainPackVersionId(),
        draftResult.versionNo(),
        draftResult.packKey(),
        draftResult.createdPack(),
        draftResult.sourcePipelineJobId());
  }

  private String buildIntermediateSummaryJson(CreateDomainPackDraftFromPipelineResult result) {
    ObjectNode summary = objectMapper.createObjectNode();
    summary.put("domainPackId", result.domainPackId());
    summary.put("domainPackVersionId", result.domainPackVersionId());
    summary.put("versionNo", result.versionNo());
    summary.put("packKey", result.packKey());
    summary.put("createdPack", result.createdPack());
    try {
      return objectMapper.writeValueAsString(summary);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Domain pack draft 중간 요약 JSON 생성에 실패했습니다.", ex);
    }
  }
}
