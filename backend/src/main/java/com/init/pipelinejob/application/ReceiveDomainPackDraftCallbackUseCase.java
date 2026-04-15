package com.init.pipelinejob.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.application.CreateDomainPackDraftFromPipelineCommand;
import com.init.domainpack.application.CreateDomainPackDraftFromPipelineResult;
import com.init.domainpack.application.CreateDomainPackDraftFromPipelineUseCase;
import com.init.pipelinejob.application.exception.AirflowWebhookUnauthorizedException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyFinalizedException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackNotAllowedException;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.PipelineArtifactRepository;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.pipelinejob.domain.repository.WebhookReceiptRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class ReceiveDomainPackDraftCallbackUseCase {

  private static final String WEBHOOK_TYPE = "DOMAIN_PACK_DRAFT_CALLBACK";
  private static final String STAGE_NAME = "publish-candidate";
  private static final String ARTIFACT_TYPE = "DOMAIN_PACK_DRAFT_PAYLOAD";

  private final PipelineJobRepository pipelineJobRepository;
  private final WebhookReceiptRepository webhookReceiptRepository;
  private final PipelineArtifactRepository pipelineArtifactRepository;
  private final CreateDomainPackDraftFromPipelineUseCase createDomainPackDraftFromPipelineUseCase;
  private final Clock clock;
  private final ObjectMapper objectMapper;
  private final TransactionTemplate transactionTemplate;
  private final String airflowWebhookSecret;

  public ReceiveDomainPackDraftCallbackUseCase(
      PipelineJobRepository pipelineJobRepository,
      WebhookReceiptRepository webhookReceiptRepository,
      PipelineArtifactRepository pipelineArtifactRepository,
      CreateDomainPackDraftFromPipelineUseCase createDomainPackDraftFromPipelineUseCase,
      Clock clock,
      ObjectMapper objectMapper,
      PlatformTransactionManager transactionManager,
      @Value("${airflow.webhook.secret}") String airflowWebhookSecret) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.webhookReceiptRepository = webhookReceiptRepository;
    this.pipelineArtifactRepository = pipelineArtifactRepository;
    this.createDomainPackDraftFromPipelineUseCase = createDomainPackDraftFromPipelineUseCase;
    this.clock = clock;
    this.objectMapper = objectMapper;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
    this.airflowWebhookSecret = airflowWebhookSecret;
  }

  public ReceiveDomainPackDraftCallbackResult execute(
      ReceiveDomainPackDraftCallbackCommand command) {
    validateWebhookSecret(command.providedWebhookSecret());

    Optional<WebhookReceipt> existingReceipt =
        webhookReceiptRepository.findByExternalEventId(command.externalEventId());
    if (isProcessed(existingReceipt.orElse(null))) {
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

    WebhookReceipt receipt = ensureReceivedReceipt(command, existingReceipt.orElse(null));
    if (isProcessed(receipt)) {
      return ReceiveDomainPackDraftCallbackResult.duplicateIgnored(command.externalEventId());
    }

    try {
      return transactionTemplate.execute(status -> processCallback(command));
    } catch (RuntimeException ex) {
      try {
        markFailure(command.jobId(), command.externalEventId(), ex);
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

    OffsetDateTime now = OffsetDateTime.now(clock);
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
    pipelineJobRepository.saveAndFlush(job);

    WebhookReceipt receipt =
        webhookReceiptRepository
            .findByExternalEventId(command.externalEventId())
            .orElseThrow(() -> new IllegalStateException("Webhook receipt가 존재하지 않습니다."));
    receipt.markProcessed(now);
    webhookReceiptRepository.saveAndFlush(receipt);

    return ReceiveDomainPackDraftCallbackResult.created(
        command.externalEventId(),
        draftResult.domainPackId(),
        draftResult.domainPackVersionId(),
        draftResult.versionNo(),
        draftResult.packKey(),
        draftResult.createdPack(),
        draftResult.sourcePipelineJobId());
  }

  private WebhookReceipt ensureReceivedReceipt(
      ReceiveDomainPackDraftCallbackCommand command, WebhookReceipt existingReceipt) {
    if (existingReceipt != null) {
      return existingReceipt;
    }

    try {
      return transactionTemplate.execute(
          status ->
              webhookReceiptRepository.saveAndFlush(
                  WebhookReceipt.receive(
                      command.jobId(),
                      command.externalEventId(),
                      WEBHOOK_TYPE,
                      command.requestHeadersJson(),
                      command.requestBodyJson(),
                      OffsetDateTime.now(clock))));
    } catch (DataIntegrityViolationException ex) {
      Optional<WebhookReceipt> concurrentReceipt =
          webhookReceiptRepository.findByExternalEventId(command.externalEventId());
      if (concurrentReceipt.isPresent()) {
        return concurrentReceipt.get();
      }
      throw ex;
    }
  }

  private void markFailure(Long jobId, String externalEventId, RuntimeException exception) {
    transactionTemplate.executeWithoutResult(
        status -> {
          OffsetDateTime now = OffsetDateTime.now(clock);
          webhookReceiptRepository
              .findByExternalEventId(externalEventId)
              .ifPresent(
                  receipt -> {
                    if (!WebhookReceipt.STATUS_PROCESSED.equals(receipt.getProcessingStatus())) {
                      receipt.markFailed(now);
                      webhookReceiptRepository.saveAndFlush(receipt);
                    }
                  });

          if (exception instanceof PipelineJobAlreadyFinalizedException
              || exception instanceof PipelineJobCallbackNotAllowedException) {
            return;
          }

          pipelineJobRepository
              .findById(jobId)
              .ifPresent(
                  job -> {
                    if (!job.isFinalized()) {
                      job.markFailed(resolveErrorMessage(exception), now);
                      pipelineJobRepository.saveAndFlush(job);
                    }
                  });
        });
  }

  private void validateWebhookSecret(String providedSecret) {
    byte[] expected =
        airflowWebhookSecret == null
            ? new byte[0]
            : airflowWebhookSecret.getBytes(StandardCharsets.UTF_8);
    byte[] actual =
        providedSecret == null ? new byte[0] : providedSecret.getBytes(StandardCharsets.UTF_8);
    if (!MessageDigest.isEqual(actual, expected)) {
      throw new AirflowWebhookUnauthorizedException();
    }
  }

  private boolean isProcessed(WebhookReceipt receipt) {
    return receipt != null && WebhookReceipt.STATUS_PROCESSED.equals(receipt.getProcessingStatus());
  }

  private String resolveErrorMessage(RuntimeException exception) {
    String message = exception.getMessage();
    return message == null || message.isBlank() ? exception.getClass().getSimpleName() : message;
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
