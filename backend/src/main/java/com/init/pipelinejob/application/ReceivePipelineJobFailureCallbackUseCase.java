package com.init.pipelinejob.application;

import com.init.pipelinejob.application.exception.PipelineJobAlreadySucceededException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackTargetMismatchException;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class ReceivePipelineJobFailureCallbackUseCase {

  private static final String WEBHOOK_TYPE = "PIPELINE_JOB_FAILURE_CALLBACK";

  private final PipelineJobRepository pipelineJobRepository;
  private final PipelineJobCallbackSupportService callbackSupportService;

  public ReceivePipelineJobFailureCallbackUseCase(
      PipelineJobRepository pipelineJobRepository,
      PipelineJobCallbackSupportService callbackSupportService) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.callbackSupportService = callbackSupportService;
  }

  public ReceivePipelineJobFailureCallbackResult execute(
      ReceivePipelineJobFailureCallbackCommand command) {
    callbackSupportService.validateWebhookSecret(command.providedWebhookSecret());

    Optional<WebhookReceipt> existingReceipt =
        callbackSupportService.findReceipt(command.externalEventId());
    callbackSupportService.validateWebhookType(
        existingReceipt.orElse(null), command.externalEventId(), WEBHOOK_TYPE);
    if (callbackSupportService.isProcessed(existingReceipt.orElse(null))) {
      PipelineJob job = findJob(command.jobId());
      return ReceivePipelineJobFailureCallbackResult.of(
          "DUPLICATE_IGNORED", command.externalEventId(), command.jobId(), job.getStatus());
    }

    PipelineJob job = findJob(command.jobId());
    validateTarget(job, command);

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
      return ReceivePipelineJobFailureCallbackResult.of(
          "DUPLICATE_IGNORED", command.externalEventId(), command.jobId(), job.getStatus());
    }

    return callbackSupportService.executeInTransactionOrMarkFailure(
        command.jobId(), command.externalEventId(), () -> processCallback(command));
  }

  private ReceivePipelineJobFailureCallbackResult processCallback(
      ReceivePipelineJobFailureCallbackCommand command) {
    PipelineJob job = findJob(command.jobId());
    validateTarget(job, command);

    if (job.isSucceeded()) {
      throw new PipelineJobAlreadySucceededException(command.jobId());
    }

    String resultStatus = "PROCESSED";
    if (job.isFailed()) {
      resultStatus = "IGNORED_ALREADY_FAILED";
    } else if (job.isCancelled()) {
      resultStatus = "IGNORED_CANCELLED";
    } else {
      job.markFailed(command.message(), command.occurredAt());
      callbackSupportService.savePipelineJobOrThrowConflict(job, command.jobId());
    }

    callbackSupportService.markReceiptProcessed(
        command.externalEventId(), callbackSupportService.now());
    return ReceivePipelineJobFailureCallbackResult.of(
        resultStatus, command.externalEventId(), command.jobId(), job.getStatus());
  }

  private PipelineJob findJob(Long jobId) {
    return pipelineJobRepository
        .findById(jobId)
        .orElseThrow(() -> new PipelineJobNotFoundException(jobId));
  }

  private void validateTarget(PipelineJob job, ReceivePipelineJobFailureCallbackCommand command) {
    if (!Objects.equals(job.getAirflowDagId(), command.dagId())
        || !Objects.equals(job.getAirflowRunId(), command.dagRunId())) {
      throw new PipelineJobCallbackTargetMismatchException(
          job.getId(),
          job.getAirflowDagId(),
          command.dagId(),
          job.getAirflowRunId(),
          command.dagRunId());
    }
  }
}
