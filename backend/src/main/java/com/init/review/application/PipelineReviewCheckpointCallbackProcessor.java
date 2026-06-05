package com.init.review.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.application.PipelineJobCallbackSupportService;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyFinalizedException;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.PipelineArtifactRepository;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.review.domain.model.ReviewSession;
import com.init.review.domain.repository.ReviewSessionRepository;
import com.init.review.domain.repository.ReviewTaskRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class PipelineReviewCheckpointCallbackProcessor {

  private static final String ARTIFACT_DOMAIN_CANDIDATES = "DOMAIN_CANDIDATES";
  private static final String ARTIFACT_FEEDBACK_QUESTIONS = "FEEDBACK_QUESTIONS";
  private static final String FIELD_UPSTREAM_MANIFEST_PATH = "upstreamManifestPath";

  private final PipelineJobRepository pipelineJobRepository;
  private final PipelineArtifactRepository pipelineArtifactRepository;
  private final ReviewSessionRepository reviewSessionRepository;
  private final ReviewTaskRepository reviewTaskRepository;
  private final PipelineJobCallbackSupportService callbackSupportService;
  private final PipelineReviewTaskFactory taskFactory;
  private final PipelineReviewCheckpointJsonSupport jsonSupport;

  public PipelineReviewCheckpointCallbackProcessor(
      PipelineJobRepository pipelineJobRepository,
      PipelineArtifactRepository pipelineArtifactRepository,
      ReviewSessionRepository reviewSessionRepository,
      ReviewTaskRepository reviewTaskRepository,
      PipelineJobCallbackSupportService callbackSupportService,
      PipelineReviewTaskFactory taskFactory,
      PipelineReviewCheckpointJsonSupport jsonSupport) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.pipelineArtifactRepository = pipelineArtifactRepository;
    this.reviewSessionRepository = reviewSessionRepository;
    this.reviewTaskRepository = reviewTaskRepository;
    this.callbackSupportService = callbackSupportService;
    this.taskFactory = taskFactory;
    this.jsonSupport = jsonSupport;
  }

  public PipelineReviewCheckpointUseCase.CheckpointCallbackResult
      receiveDomainConfirmationCheckpoint(
          PipelineReviewCheckpointUseCase.CheckpointCallbackCommand command) {
    return receiveCheckpoint(
        command,
        PipelineReviewCheckpointUseCase.WEBHOOK_TYPE_DOMAIN_CONFIRMATION,
        ReviewSession.KIND_DOMAIN_CONFIRMATION,
        ARTIFACT_DOMAIN_CANDIDATES,
        PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION);
  }

  public PipelineReviewCheckpointUseCase.CheckpointCallbackResult receiveHumanFeedbackCheckpoint(
      PipelineReviewCheckpointUseCase.CheckpointCallbackCommand command) {
    return receiveCheckpoint(
        command,
        PipelineReviewCheckpointUseCase.WEBHOOK_TYPE_HUMAN_FEEDBACK,
        ReviewSession.KIND_HUMAN_FEEDBACK,
        ARTIFACT_FEEDBACK_QUESTIONS,
        PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK);
  }

  private PipelineReviewCheckpointUseCase.CheckpointCallbackResult receiveCheckpoint(
      PipelineReviewCheckpointUseCase.CheckpointCallbackCommand command,
      String webhookType,
      String reviewKind,
      String artifactType,
      String waitingStatus) {
    callbackSupportService.validateWebhookSecret(command.providedWebhookSecret());
    Optional<WebhookReceipt> existingReceipt =
        callbackSupportService.findReceipt(command.externalEventId());
    callbackSupportService.validateWebhookType(
        existingReceipt.orElse(null), command.externalEventId(), webhookType);
    if (callbackSupportService.isProcessed(existingReceipt.orElse(null))) {
      return duplicateIgnored(command);
    }
    PipelineJob job = runningJob(command.jobId());
    if (job.isFinalized()) {
      throw new PipelineJobAlreadyFinalizedException(command.jobId());
    }
    WebhookReceipt receipt =
        callbackSupportService.ensureReceivedReceipt(
            command.jobId(),
            command.externalEventId(),
            webhookType,
            command.requestHeadersJson(),
            command.requestBodyJson(),
            existingReceipt.orElse(null));
    callbackSupportService.validateWebhookType(receipt, command.externalEventId(), webhookType);
    if (callbackSupportService.isProcessed(receipt)) {
      return duplicateIgnored(command);
    }
    return callbackSupportService.executeInTransactionOrMarkFailure(
        command.jobId(),
        command.externalEventId(),
        () -> processCheckpoint(command, reviewKind, artifactType, waitingStatus));
  }

  private PipelineReviewCheckpointUseCase.CheckpointCallbackResult duplicateIgnored(
      PipelineReviewCheckpointUseCase.CheckpointCallbackCommand command) {
    return new PipelineReviewCheckpointUseCase.CheckpointCallbackResult(
        "DUPLICATE_IGNORED", command.externalEventId());
  }

  private PipelineReviewCheckpointUseCase.CheckpointCallbackResult processCheckpoint(
      PipelineReviewCheckpointUseCase.CheckpointCallbackCommand command,
      String reviewKind,
      String artifactType,
      String waitingStatus) {
    PipelineJob job = runningJob(command.jobId());
    if (job.isFinalized()) {
      throw new PipelineJobAlreadyFinalizedException(command.jobId());
    }
    OffsetDateTime now = callbackSupportService.now();
    JsonNode artifactPayloadNode = jsonSupport.requireArtifactPayload(command.artifactPayload());
    String artifactPayload = jsonSupport.toJson(artifactPayloadNode);
    pipelineArtifactRepository.save(
        PipelineArtifact.create(
            job.getId(),
            reviewKind.toLowerCase(),
            artifactType,
            command.artifactPath(),
            null,
            artifactPayload,
            now));
    ReviewSession session =
        reviewSessionRepository.save(
            ReviewSession.createPipelineCheckpoint(
                job.getWorkspaceId(),
                job.getId(),
                job.getDatasetId(),
                reviewKind,
                titleFor(reviewKind),
                "Pipeline checkpoint review",
                summaryJson(command, reviewKind),
                now));
    reviewTaskRepository.saveAll(
        taskFactory.createTasks(session.getId(), reviewKind, artifactPayloadNode, now));
    markWaiting(job, waitingStatus, summaryJson(command, reviewKind));
    callbackSupportService.savePipelineJobOrThrowConflict(job, command.jobId());
    callbackSupportService.markReceiptProcessed(command.externalEventId(), now);
    return new PipelineReviewCheckpointUseCase.CheckpointCallbackResult(
        "CREATED", command.externalEventId());
  }

  private PipelineJob runningJob(Long jobId) {
    return pipelineJobRepository
        .findById(jobId)
        .orElseThrow(() -> new PipelineJobNotFoundException(jobId));
  }

  private void markWaiting(PipelineJob job, String waitingStatus, String summaryJson) {
    if (PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION.equals(waitingStatus)) {
      job.markAwaitingDomainConfirmation(summaryJson);
    } else {
      job.markAwaitingHumanFeedback(summaryJson);
    }
  }

  private String titleFor(String reviewKind) {
    return ReviewSession.KIND_DOMAIN_CONFIRMATION.equals(reviewKind) ? "상담 도메인 확정" : "클러스터링 피드백";
  }

  private String summaryJson(
      PipelineReviewCheckpointUseCase.CheckpointCallbackCommand command, String reviewKind) {
    ObjectNode summary = jsonSupport.objectNode();
    summary.put("reviewKind", reviewKind);
    summary.put(FIELD_UPSTREAM_MANIFEST_PATH, command.upstreamManifestPath());
    summary.put("artifactPath", command.artifactPath());
    return jsonSupport.toJson(summary);
  }
}
