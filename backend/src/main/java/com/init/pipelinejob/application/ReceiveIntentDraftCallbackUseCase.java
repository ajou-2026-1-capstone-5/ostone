package com.init.pipelinejob.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyFinalizedException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackNotAllowedException;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class ReceiveIntentDraftCallbackUseCase {

  private static final String WEBHOOK_TYPE = "INTENT_DRAFT_CALLBACK";

  private final PipelineJobRepository pipelineJobRepository;
  private final AddIntentsToDraftVersionPort addIntentsToDraftVersionPort;
  private final ObjectMapper objectMapper;
  private final PipelineJobCallbackSupportService callbackSupportService;

  public ReceiveIntentDraftCallbackUseCase(
      PipelineJobRepository pipelineJobRepository,
      AddIntentsToDraftVersionPort addIntentsToDraftVersionPort,
      ObjectMapper objectMapper,
      PipelineJobCallbackSupportService callbackSupportService) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.addIntentsToDraftVersionPort = addIntentsToDraftVersionPort;
    this.objectMapper = objectMapper;
    this.callbackSupportService = callbackSupportService;
  }

  public ReceiveIntentDraftCallbackResult execute(ReceiveIntentDraftCallbackCommand command) {
    callbackSupportService.validateWebhookSecret(command.providedWebhookSecret());

    Optional<WebhookReceipt> existingReceipt =
        callbackSupportService.findReceipt(command.externalEventId());
    callbackSupportService.validateWebhookType(
        existingReceipt.orElse(null), command.externalEventId(), WEBHOOK_TYPE);
    if (callbackSupportService.isProcessed(existingReceipt.orElse(null))) {
      return ReceiveIntentDraftCallbackResult.duplicateIgnored(command.externalEventId());
    }

    PipelineJob job =
        pipelineJobRepository
            .findById(command.jobId())
            .orElseThrow(() -> new PipelineJobNotFoundException(command.jobId()));
    if (job.isFinalized()) {
      throw new PipelineJobAlreadyFinalizedException(command.jobId());
    }
    if (!job.canAcceptIntentDraftCallback()) {
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
      return ReceiveIntentDraftCallbackResult.duplicateIgnored(command.externalEventId());
    }

    return callbackSupportService.executeInTransactionOrMarkFailure(
        command.jobId(), command.externalEventId(), () -> processCallback(command));
  }

  private ReceiveIntentDraftCallbackResult processCallback(
      ReceiveIntentDraftCallbackCommand command) {
    PipelineJob job =
        pipelineJobRepository
            .findById(command.jobId())
            .orElseThrow(() -> new PipelineJobNotFoundException(command.jobId()));
    if (job.isFinalized()) {
      throw new PipelineJobAlreadyFinalizedException(command.jobId());
    }
    if (!job.canAcceptIntentDraftCallback()) {
      throw new PipelineJobCallbackNotAllowedException(
          command.jobId(), job.getStatus(), WEBHOOK_TYPE);
    }

    AddIntentsToDraftVersionPortResult intentResult =
        addIntentsToDraftVersionPort.execute(
            new AddIntentsToDraftVersionPortCommand(
                command.domainPackVersionId(), command.intents()));

    OffsetDateTime now = callbackSupportService.now();
    job.markAwaitingWorkflowCallback(
        intentResult.domainPackId(), buildSuccessSummaryJson(intentResult));
    callbackSupportService.savePipelineJobOrThrowConflict(job, command.jobId());
    callbackSupportService.markReceiptProcessed(command.externalEventId(), now);

    return ReceiveIntentDraftCallbackResult.created(
        command.externalEventId(),
        command.domainPackVersionId(),
        intentResult.addedIntentCount(),
        intentResult.skippedIntentCount(),
        intentResult.totalIntentCount(),
        command.jobId());
  }

  private String buildSuccessSummaryJson(AddIntentsToDraftVersionPortResult result) {
    ObjectNode summary = objectMapper.createObjectNode();
    summary.put("domainPackId", result.domainPackId());
    summary.put("domainPackVersionId", result.domainPackVersionId());
    summary.put("addedIntentCount", result.addedIntentCount());
    summary.put("skippedIntentCount", result.skippedIntentCount());
    summary.put("totalIntentCount", result.totalIntentCount());
    try {
      return objectMapper.writeValueAsString(summary);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Intent callback 성공 요약 JSON 생성에 실패했습니다.", ex);
    }
  }
}
