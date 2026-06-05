package com.init.pipelinejob.application;

import com.init.pipelinejob.application.exception.AirflowWebhookUnauthorizedException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyFinalizedException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackNotAllowedException;
import com.init.pipelinejob.application.exception.PipelineJobConflictException;
import com.init.pipelinejob.application.exception.WebhookReceiptTypeConflictException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.pipelinejob.domain.repository.WebhookReceiptRepository;
import com.init.workspace.application.WorkspaceFreeOnboardingService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

// NOTE: 선언적 @Transactional 대신 TransactionTemplate을 사용한다.
// webhook receipt 저장과 pipeline job 상태 갱신을 독립된 트랜잭션으로 분리해야 하므로
// 클래스 레벨 @Transactional(readOnly = true) 컨벤션의 의도적 예외.
@Service
public class PipelineJobCallbackSupportService {

  private final PipelineJobRepository pipelineJobRepository;
  private final WebhookReceiptRepository webhookReceiptRepository;
  private final Clock clock;
  private final TransactionTemplate transactionTemplate;
  private final String airflowWebhookSecret;
  private final WorkspaceFreeOnboardingService freeOnboardingService;

  public PipelineJobCallbackSupportService(
      PipelineJobRepository pipelineJobRepository,
      WebhookReceiptRepository webhookReceiptRepository,
      Clock clock,
      PlatformTransactionManager transactionManager,
      @Value("${airflow.webhook.secret}") String airflowWebhookSecret,
      WorkspaceFreeOnboardingService freeOnboardingService) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.webhookReceiptRepository = webhookReceiptRepository;
    this.clock = clock;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
    this.airflowWebhookSecret = resolveAirflowWebhookSecret(airflowWebhookSecret);
    this.freeOnboardingService = freeOnboardingService;
  }

  public void validateWebhookSecret(String providedSecret) {
    byte[] expected = airflowWebhookSecret.getBytes(StandardCharsets.UTF_8);
    byte[] actual =
        providedSecret == null ? new byte[0] : providedSecret.getBytes(StandardCharsets.UTF_8);
    if (!MessageDigest.isEqual(actual, expected)) {
      throw new AirflowWebhookUnauthorizedException();
    }
  }

  public Optional<WebhookReceipt> findReceipt(String externalEventId) {
    return webhookReceiptRepository.findByExternalEventId(externalEventId);
  }

  public boolean isProcessed(WebhookReceipt receipt) {
    return receipt != null && WebhookReceipt.STATUS_PROCESSED.equals(receipt.getProcessingStatus());
  }

  public void validateWebhookType(
      WebhookReceipt receipt, String externalEventId, String expectedWebhookType) {
    if (receipt != null && !expectedWebhookType.equals(receipt.getWebhookType())) {
      throw new WebhookReceiptTypeConflictException(
          externalEventId, receipt.getWebhookType(), expectedWebhookType);
    }
  }

  public WebhookReceipt ensureReceivedReceipt(
      Long jobId,
      String externalEventId,
      String webhookType,
      String requestHeadersJson,
      String requestBodyJson,
      WebhookReceipt existingReceipt) {
    if (existingReceipt != null) {
      return existingReceipt;
    }

    try {
      return transactionTemplate.execute(
          status ->
              webhookReceiptRepository.saveAndFlush(
                  WebhookReceipt.receive(
                      jobId,
                      externalEventId,
                      webhookType,
                      requestHeadersJson,
                      requestBodyJson,
                      now())));
    } catch (DataIntegrityViolationException ex) {
      Optional<WebhookReceipt> concurrentReceipt =
          webhookReceiptRepository.findByExternalEventId(externalEventId);
      if (concurrentReceipt.isPresent()) {
        return concurrentReceipt.get();
      }
      throw ex;
    }
  }

  public <T> T executeInTransactionOrMarkFailure(
      Long jobId, String externalEventId, Supplier<T> callback) {
    try {
      return executeInTransaction(callback);
    } catch (RuntimeException ex) {
      try {
        markFailure(jobId, externalEventId, ex);
      } catch (RuntimeException markFailureException) {
        ex.addSuppressed(markFailureException);
      }
      throw ex;
    }
  }

  public void markReceiptProcessed(String externalEventId, OffsetDateTime processedAt) {
    WebhookReceipt receipt =
        webhookReceiptRepository
            .findByExternalEventId(externalEventId)
            .orElseThrow(() -> new IllegalStateException("Webhook receipt가 존재하지 않습니다."));
    receipt.markProcessed(processedAt);
    webhookReceiptRepository.saveAndFlush(receipt);
  }

  private void markFailure(Long jobId, String externalEventId, RuntimeException exception) {
    transactionTemplate.executeWithoutResult(
        status -> {
          OffsetDateTime now = now();
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

          if (exception instanceof PipelineJobConflictException) {
            return;
          }

          pipelineJobRepository
              .findById(jobId)
              .ifPresent(
                  job -> {
                    if (!job.isFinalized()) {
                      job.markFailed(resolveErrorMessage(exception), now);
                      pipelineJobRepository.saveAndFlush(job);
                      freeOnboardingService.consumeForFinalPipelineJob(
                          job.getWorkspaceId(), job.getId(), job.isFinalized());
                    }
                  });
        });
  }

  public void savePipelineJobOrThrowConflict(PipelineJob job, Long jobId) {
    try {
      pipelineJobRepository.saveAndFlush(job);
    } catch (ObjectOptimisticLockingFailureException ex) {
      throw new PipelineJobConflictException(jobId);
    }
  }

  public OffsetDateTime now() {
    return OffsetDateTime.now(clock);
  }

  private String resolveAirflowWebhookSecret(String airflowWebhookSecret) {
    if (airflowWebhookSecret == null || airflowWebhookSecret.isBlank()) {
      throw new IllegalArgumentException("airflow.webhook.secret must not be blank");
    }
    return airflowWebhookSecret;
  }

  private <T> T executeInTransaction(Supplier<T> callback) {
    return transactionTemplate.execute(status -> callback.get());
  }

  private String resolveErrorMessage(RuntimeException exception) {
    String message = exception.getMessage();
    return message == null || message.isBlank() ? exception.getClass().getSimpleName() : message;
  }
}
