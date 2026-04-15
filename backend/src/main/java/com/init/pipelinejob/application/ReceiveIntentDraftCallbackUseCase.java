package com.init.pipelinejob.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.application.AddIntentsToDraftVersionCommand;
import com.init.domainpack.application.AddIntentsToDraftVersionResult;
import com.init.domainpack.application.AddIntentsToDraftVersionUseCase;
import com.init.pipelinejob.application.exception.AirflowWebhookUnauthorizedException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyFinalizedException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackNotAllowedException;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.pipelinejob.domain.repository.WebhookReceiptRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class ReceiveIntentDraftCallbackUseCase {

  private static final String WEBHOOK_TYPE = "INTENT_DRAFT_CALLBACK";

  private final PipelineJobRepository pipelineJobRepository;
  private final WebhookReceiptRepository webhookReceiptRepository;
  private final AddIntentsToDraftVersionUseCase addIntentsToDraftVersionUseCase;
  private final Clock clock;
  private final ObjectMapper objectMapper;
  private final TransactionTemplate transactionTemplate;
  private final String airflowWebhookSecret;

  public ReceiveIntentDraftCallbackUseCase(
      PipelineJobRepository pipelineJobRepository,
      WebhookReceiptRepository webhookReceiptRepository,
      AddIntentsToDraftVersionUseCase addIntentsToDraftVersionUseCase,
      Clock clock,
      ObjectMapper objectMapper,
      PlatformTransactionManager transactionManager,
      @Value("${airflow.webhook.secret}") String airflowWebhookSecret) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.webhookReceiptRepository = webhookReceiptRepository;
    this.addIntentsToDraftVersionUseCase = addIntentsToDraftVersionUseCase;
    this.clock = clock;
    this.objectMapper = objectMapper;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
    this.airflowWebhookSecret = airflowWebhookSecret;
  }

  public ReceiveIntentDraftCallbackResult execute(ReceiveIntentDraftCallbackCommand command) {
    validateWebhookSecret(command.providedWebhookSecret());

    if (webhookReceiptRepository.findByExternalEventId(command.externalEventId()).isPresent()) {
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

    if (!persistReceivedReceipt(command)) {
      return ReceiveIntentDraftCallbackResult.duplicateIgnored(command.externalEventId());
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

    AddIntentsToDraftVersionResult intentResult =
        addIntentsToDraftVersionUseCase.execute(
            new AddIntentsToDraftVersionCommand(command.domainPackVersionId(), command.intents()));

    OffsetDateTime now = OffsetDateTime.now(clock);
    job.markSucceeded(intentResult.domainPackId(), buildSuccessSummaryJson(intentResult), now);
    pipelineJobRepository.saveAndFlush(job);

    WebhookReceipt receipt =
        webhookReceiptRepository
            .findByExternalEventId(command.externalEventId())
            .orElseThrow(() -> new IllegalStateException("Webhook receipt가 존재하지 않습니다."));
    receipt.markProcessed(now);
    webhookReceiptRepository.saveAndFlush(receipt);

    return ReceiveIntentDraftCallbackResult.created(
        command.externalEventId(),
        command.domainPackVersionId(),
        intentResult.addedIntentCount(),
        intentResult.skippedIntentCount(),
        intentResult.totalIntentCount(),
        command.jobId());
  }

  private boolean persistReceivedReceipt(ReceiveIntentDraftCallbackCommand command) {
    try {
      transactionTemplate.executeWithoutResult(
          status ->
              webhookReceiptRepository.saveAndFlush(
                  WebhookReceipt.receive(
                      command.jobId(),
                      command.externalEventId(),
                      WEBHOOK_TYPE,
                      command.requestHeadersJson(),
                      command.requestBodyJson(),
                      OffsetDateTime.now(clock))));
      return true;
    } catch (DataIntegrityViolationException ex) {
      if (webhookReceiptRepository.findByExternalEventId(command.externalEventId()).isPresent()) {
        return false;
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
    if (providedSecret == null || !providedSecret.equals(airflowWebhookSecret)) {
      throw new AirflowWebhookUnauthorizedException();
    }
  }

  private String resolveErrorMessage(RuntimeException exception) {
    String message = exception.getMessage();
    return message == null || message.isBlank() ? exception.getClass().getSimpleName() : message;
  }

  private String buildSuccessSummaryJson(AddIntentsToDraftVersionResult result) {
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
