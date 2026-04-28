package com.init.pipelinejob.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.application.AddWorkflowDraftToVersionCommand;
import com.init.domainpack.application.AddWorkflowDraftToVersionResult;
import com.init.domainpack.application.AddWorkflowDraftToVersionUseCase;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.pipelinejob.application.exception.AirflowWebhookUnauthorizedException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyFinalizedException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackNotAllowedException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackTargetMismatchException;
import com.init.pipelinejob.application.exception.PipelineJobConflictException;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
import com.init.pipelinejob.application.exception.WebhookReceiptTypeConflictException;
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
import java.util.Objects;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class ReceiveWorkflowDraftCallbackUseCase {

  private static final String WEBHOOK_TYPE = "WORKFLOW_DRAFT_CALLBACK";
  private static final String STAGE_NAME = "publish-candidate";
  private static final String ARTIFACT_TYPE = "WORKFLOW_DRAFT_PAYLOAD";

  private final PipelineJobRepository pipelineJobRepository;
  private final WebhookReceiptRepository webhookReceiptRepository;
  private final PipelineArtifactRepository pipelineArtifactRepository;
  private final AddWorkflowDraftToVersionUseCase addWorkflowDraftToVersionUseCase;
  private final DomainPackVersionRepository domainPackVersionRepository;
  private final DomainPackRepository domainPackRepository;
  private final Clock clock;
  private final ObjectMapper objectMapper;
  private final TransactionTemplate transactionTemplate;
  private final String airflowWebhookSecret;

  public ReceiveWorkflowDraftCallbackUseCase(
      PipelineJobRepository pipelineJobRepository,
      WebhookReceiptRepository webhookReceiptRepository,
      PipelineArtifactRepository pipelineArtifactRepository,
      AddWorkflowDraftToVersionUseCase addWorkflowDraftToVersionUseCase,
      DomainPackVersionRepository domainPackVersionRepository,
      DomainPackRepository domainPackRepository,
      Clock clock,
      ObjectMapper objectMapper,
      PlatformTransactionManager transactionManager,
      @Value("${airflow.webhook.secret}") String airflowWebhookSecret) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.webhookReceiptRepository = webhookReceiptRepository;
    this.pipelineArtifactRepository = pipelineArtifactRepository;
    this.addWorkflowDraftToVersionUseCase = addWorkflowDraftToVersionUseCase;
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.domainPackRepository = domainPackRepository;
    this.clock = clock;
    this.objectMapper = objectMapper;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
    this.airflowWebhookSecret = airflowWebhookSecret;
  }

  public ReceiveWorkflowDraftCallbackResult execute(ReceiveWorkflowDraftCallbackCommand command) {
    validateWebhookSecret(command.providedWebhookSecret());

    Optional<WebhookReceipt> existingReceipt =
        webhookReceiptRepository.findByExternalEventId(command.externalEventId());
    validateWebhookType(existingReceipt.orElse(null), command.externalEventId());
    if (isProcessed(existingReceipt.orElse(null))) {
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

    WebhookReceipt receipt = ensureReceivedReceipt(command, existingReceipt.orElse(null));
    validateWebhookType(receipt, command.externalEventId());
    if (isProcessed(receipt)) {
      return ReceiveWorkflowDraftCallbackResult.duplicateIgnored(command.externalEventId());
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
    validateTargetVersion(job, command.domainPackVersionId());

    OffsetDateTime now = OffsetDateTime.now(clock);
    pipelineArtifactRepository.save(
        PipelineArtifact.create(
            job.getId(), STAGE_NAME, ARTIFACT_TYPE, null, null, command.requestBodyJson(), now));

    AddWorkflowDraftToVersionResult workflowResult =
        addWorkflowDraftToVersionUseCase.execute(
            new AddWorkflowDraftToVersionCommand(
                command.domainPackVersionId(),
                command.slots(),
                command.policies(),
                command.risks(),
                command.workflows(),
                command.intentSlotBindings(),
                command.intentWorkflowBindings()));

    job.markSucceeded(workflowResult.domainPackId(), buildSuccessSummaryJson(workflowResult), now);
    savePipelineJobOrThrowConflict(job, command.jobId());

    WebhookReceipt receipt =
        webhookReceiptRepository
            .findByExternalEventId(command.externalEventId())
            .orElseThrow(() -> new IllegalStateException("Webhook receipt가 존재하지 않습니다."));
    receipt.markProcessed(now);
    webhookReceiptRepository.saveAndFlush(receipt);

    return ReceiveWorkflowDraftCallbackResult.created(
        command.externalEventId(),
        workflowResult.domainPackId(),
        workflowResult.domainPackVersionId(),
        workflowResult.addedSlotCount(),
        workflowResult.addedPolicyCount(),
        workflowResult.addedRiskCount(),
        workflowResult.addedWorkflowCount(),
        workflowResult.addedIntentSlotBindingCount(),
        workflowResult.addedIntentWorkflowBindingCount(),
        command.jobId());
  }

  private WebhookReceipt ensureReceivedReceipt(
      ReceiveWorkflowDraftCallbackCommand command, WebhookReceipt existingReceipt) {
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

  private void validateWebhookType(WebhookReceipt receipt, String externalEventId) {
    if (receipt != null && !WEBHOOK_TYPE.equals(receipt.getWebhookType())) {
      throw new WebhookReceiptTypeConflictException(
          externalEventId, receipt.getWebhookType(), WEBHOOK_TYPE);
    }
  }

  private void validateTargetVersion(PipelineJob job, Long domainPackVersionId) {
    DomainPackVersion version =
        domainPackVersionRepository
            .findById(domainPackVersionId)
            .orElseThrow(() -> new DomainPackVersionNotFoundException(domainPackVersionId));
    if (!Objects.equals(job.getDomainPackId(), version.getDomainPackId())) {
      throw new PipelineJobCallbackTargetMismatchException(
          job.getId(), job.getDomainPackId(), domainPackVersionId, version.getDomainPackId());
    }
    if (!domainPackRepository.existsByIdAndWorkspaceId(
        version.getDomainPackId(), job.getWorkspaceId())) {
      throw new PipelineJobCallbackTargetMismatchException(
          job.getId(), job.getDomainPackId(), domainPackVersionId, version.getDomainPackId());
    }
  }

  private boolean isProcessed(WebhookReceipt receipt) {
    return receipt != null && WebhookReceipt.STATUS_PROCESSED.equals(receipt.getProcessingStatus());
  }

  private void savePipelineJobOrThrowConflict(PipelineJob job, Long jobId) {
    try {
      pipelineJobRepository.saveAndFlush(job);
    } catch (ObjectOptimisticLockingFailureException ex) {
      throw new PipelineJobConflictException(jobId);
    }
  }

  private String resolveErrorMessage(RuntimeException exception) {
    String message = exception.getMessage();
    return message == null || message.isBlank() ? exception.getClass().getSimpleName() : message;
  }

  private String buildSuccessSummaryJson(AddWorkflowDraftToVersionResult result) {
    ObjectNode summary = objectMapper.createObjectNode();
    summary.put("domainPackId", result.domainPackId());
    summary.put("domainPackVersionId", result.domainPackVersionId());
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
