package com.init.review.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.application.DomainPackGenerationTriggerCommand;
import com.init.pipelinejob.application.DomainPackGenerationTriggerPort;
import com.init.pipelinejob.application.PipelineJobCallbackSupportService;
import com.init.pipelinejob.application.WorkspaceMembershipPort;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyFinalizedException;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
import com.init.pipelinejob.application.exception.PipelineJobWorkspaceAccessDeniedException;
import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.PipelineArtifactRepository;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.review.domain.model.ReviewDecision;
import com.init.review.domain.model.ReviewSession;
import com.init.review.domain.model.ReviewTask;
import com.init.review.domain.repository.ReviewDecisionRepository;
import com.init.review.domain.repository.ReviewSessionRepository;
import com.init.review.domain.repository.ReviewTaskRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PipelineReviewCheckpointUseCase {

  public static final String WEBHOOK_TYPE_DOMAIN_CONFIRMATION =
      "DOMAIN_CONFIRMATION_CHECKPOINT_CALLBACK";
  public static final String WEBHOOK_TYPE_HUMAN_FEEDBACK = "HUMAN_FEEDBACK_CHECKPOINT_CALLBACK";
  private static final String ARTIFACT_DOMAIN_CANDIDATES = "DOMAIN_CANDIDATES";
  private static final String ARTIFACT_CONFIRMED_DOMAIN_PROFILE = "CONFIRMED_DOMAIN_PROFILE";
  private static final String ARTIFACT_FEEDBACK_QUESTIONS = "FEEDBACK_QUESTIONS";
  private static final String ARTIFACT_FEEDBACK_CONSTRAINTS = "FEEDBACK_CONSTRAINTS";
  private static final String FIELD_CONFIDENCE = "confidence";
  private static final String FIELD_DISPLAY_NAME = "displayName";
  private static final String FIELD_UPSTREAM_MANIFEST_PATH = "upstreamManifestPath";
  private static final Set<String> ALLOWED_REVIEW_ROLES = Set.of("OWNER", "ADMIN", "OPERATOR");

  private final PipelineJobRepository pipelineJobRepository;
  private final PipelineArtifactRepository pipelineArtifactRepository;
  private final ReviewSessionRepository reviewSessionRepository;
  private final ReviewTaskRepository reviewTaskRepository;
  private final ReviewDecisionRepository reviewDecisionRepository;
  private final PipelineJobCallbackSupportService callbackSupportService;
  private final PipelineJobFailurePersistenceService failurePersistenceService;
  private final DomainPackGenerationTriggerPort triggerPort;
  private final WorkspaceMembershipPort workspaceMembershipPort;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public PipelineReviewCheckpointUseCase(
      PipelineJobRepository pipelineJobRepository,
      PipelineArtifactRepository pipelineArtifactRepository,
      ReviewSessionRepository reviewSessionRepository,
      ReviewTaskRepository reviewTaskRepository,
      ReviewDecisionRepository reviewDecisionRepository,
      PipelineJobCallbackSupportService callbackSupportService,
      PipelineJobFailurePersistenceService failurePersistenceService,
      DomainPackGenerationTriggerPort triggerPort,
      WorkspaceMembershipPort workspaceMembershipPort,
      ObjectMapper objectMapper,
      Clock clock) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.pipelineArtifactRepository = pipelineArtifactRepository;
    this.reviewSessionRepository = reviewSessionRepository;
    this.reviewTaskRepository = reviewTaskRepository;
    this.reviewDecisionRepository = reviewDecisionRepository;
    this.callbackSupportService = callbackSupportService;
    this.failurePersistenceService = failurePersistenceService;
    this.triggerPort = triggerPort;
    this.workspaceMembershipPort = workspaceMembershipPort;
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  @Transactional
  public CheckpointCallbackResult receiveDomainConfirmationCheckpoint(
      CheckpointCallbackCommand command) {
    return receiveCheckpoint(
        command,
        WEBHOOK_TYPE_DOMAIN_CONFIRMATION,
        ReviewSession.KIND_DOMAIN_CONFIRMATION,
        ARTIFACT_DOMAIN_CANDIDATES,
        PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION);
  }

  @Transactional
  public CheckpointCallbackResult receiveHumanFeedbackCheckpoint(
      CheckpointCallbackCommand command) {
    return receiveCheckpoint(
        command,
        WEBHOOK_TYPE_HUMAN_FEEDBACK,
        ReviewSession.KIND_HUMAN_FEEDBACK,
        ARTIFACT_FEEDBACK_QUESTIONS,
        PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK);
  }

  @Transactional
  public ReviewCheckpointResult confirmDomain(ConfirmDomainCommand command) {
    PipelineJob job =
        reviewJob(
            command.workspaceId(),
            command.pipelineJobId(),
            command.userId(),
            PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION);
    ReviewSession session =
        openSession(command.pipelineJobId(), ReviewSession.KIND_DOMAIN_CONFIRMATION, true);
    requireWorkspace(session, command.workspaceId());
    ReviewTask selectedTask =
        openTaskForSession(session, command.reviewTaskId(), ReviewTask.TARGET_DOMAIN_CANDIDATE);
    JsonNode candidate = readJson(selectedTask.getTargetRefJson());
    ObjectNode profile = objectMapper.createObjectNode();
    profile.put("schemaVersion", "confirmed-domain-profile.v1");
    profile.put("candidateId", text(candidate, "candidateId"));
    profile.put("confirmedDomain", text(candidate, FIELD_DISPLAY_NAME));
    profile.put(FIELD_DISPLAY_NAME, text(candidate, FIELD_DISPLAY_NAME));
    profile.put(FIELD_CONFIDENCE, number(candidate, FIELD_CONFIDENCE));
    profile.set("evidenceTerms", candidate.path("evidenceTerms"));
    profile.set("evidenceConversationIds", candidate.path("evidenceConversationIds"));
    profile.set("domainLexicon", candidate.path("suggestedDomainLexicon"));
    profile.put("sourceReviewTaskId", selectedTask.getId());
    profile.put("confirmedBy", command.userId());

    OffsetDateTime now = OffsetDateTime.now(clock);
    selectedTask.resolve(command.userId(), now);
    reviewTaskRepository.save(selectedTask);
    reviewDecisionRepository.save(
        ReviewDecision.create(
            session.getId(),
            ReviewTask.TARGET_DOMAIN_CANDIDATE,
            selectedTask.getId(),
            "CONFIRMED_DOMAIN",
            command.reason(),
            command.userId(),
            toJson(profile),
            now));
    List<ReviewTask> remainingTasks =
        openTasksForSession(session, ReviewTask.TARGET_DOMAIN_CANDIDATE).stream()
            .filter(task -> !selectedTask.getId().equals(task.getId()))
            .toList();
    remainingTasks.forEach(task -> task.resolve(command.userId(), now));
    reviewTaskRepository.saveAll(remainingTasks);
    session.close(now);
    reviewSessionRepository.save(session);
    PipelineArtifact artifact =
        pipelineArtifactRepository.save(
            PipelineArtifact.create(
                command.pipelineJobId(),
                "domain_confirmation",
                ARTIFACT_CONFIRMED_DOMAIN_PROFILE,
                null,
                null,
                toJson(profile),
                now));
    triggerReplay(job, "DOMAIN_CONFIRMED_REPLAY", artifact.getPayloadJson(), null, false);
    return ReviewCheckpointResult.of(session.getId(), "DOMAIN_CONFIRMED_REPLAY_TRIGGERED");
  }

  @Transactional
  public ReviewCheckpointResult submitFeedback(SubmitFeedbackCommand command) {
    PipelineJob job =
        reviewJob(
            command.workspaceId(),
            command.pipelineJobId(),
            command.userId(),
            PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK);
    ReviewSession session =
        openSession(command.pipelineJobId(), ReviewSession.KIND_HUMAN_FEEDBACK, true);
    requireWorkspace(session, command.workspaceId());
    Map<Long, ReviewTask> openFeedbackTasks =
        openTasksForSession(session, ReviewTask.TARGET_FEEDBACK_PAIR).stream()
            .collect(Collectors.toMap(ReviewTask::getId, Function.identity()));
    Map<Long, FeedbackDecisionInput> decisionsByTaskId =
        command.decisions().stream()
            .collect(
                Collectors.toMap(
                    FeedbackDecisionInput::reviewTaskId,
                    Function.identity(),
                    (left, right) -> {
                      throw new BadRequestException(
                          "DUPLICATE_FEEDBACK_DECISION", "동일한 Review task 결정이 중복되었습니다.");
                    }));
    if (!decisionsByTaskId.keySet().equals(openFeedbackTasks.keySet())) {
      throw new BadRequestException(
          "FEEDBACK_DECISIONS_INCOMPLETE", "모든 열린 피드백 문항에 답변해야 replay를 시작할 수 있습니다.");
    }
    ArrayNode constraints = objectMapper.createArrayNode();
    OffsetDateTime now = OffsetDateTime.now(clock);
    for (FeedbackDecisionInput decision : decisionsByTaskId.values()) {
      ReviewTask task = openFeedbackTasks.get(decision.reviewTaskId());
      JsonNode question = readJson(task.getTargetRefJson());
      task.resolve(command.userId(), now);
      reviewTaskRepository.save(task);
      String decisionType = normalizeFeedbackDecision(decision.decisionType());
      ReviewDecision savedDecision =
          ReviewDecision.create(
              session.getId(),
              ReviewTask.TARGET_FEEDBACK_PAIR,
              task.getId(),
              decisionType,
              decision.reason(),
              command.userId(),
              toJson(decisionPayload(decisionType, question)),
              now);
      savedDecision = reviewDecisionRepository.save(savedDecision);
      if (!"unsure".equals(decisionType)) {
        ObjectNode constraint = constraints.addObject();
        constraint.put("sourceId", text(question, "sourceId"));
        constraint.put("targetId", text(question, "targetId"));
        constraint.put("type", decisionType);
        constraint.put("confidence", 1.0);
        constraint.put("scope", "intent");
        constraint.put("reviewTaskId", task.getId());
        constraint.put("decisionId", savedDecision.getId());
      }
    }
    ObjectNode payload = objectMapper.createObjectNode();
    payload.put("schemaVersion", "feedback-constraints.v1");
    payload.put("resolvedBy", command.userId());
    payload.set("constraints", constraints);
    session.close(now);
    reviewSessionRepository.save(session);
    PipelineArtifact artifact =
        pipelineArtifactRepository.save(
            PipelineArtifact.create(
                command.pipelineJobId(),
                "human_feedback",
                ARTIFACT_FEEDBACK_CONSTRAINTS,
                null,
                null,
                toJson(payload),
                now));
    triggerReplay(
        job,
        "FEEDBACK_REPLAY",
        latestArtifactJsonOrNull(job.getId(), ARTIFACT_CONFIRMED_DOMAIN_PROFILE),
        artifact.getPayloadJson(),
        true);
    return ReviewCheckpointResult.of(session.getId(), "FEEDBACK_REPLAY_TRIGGERED");
  }

  public ReviewCheckpointView getCheckpoint(Long workspaceId, Long pipelineJobId, Long userId) {
    PipelineJob job = reviewJob(workspaceId, pipelineJobId, userId, null);
    if (!workspaceId.equals(job.getWorkspaceId())) {
      throw new NotFoundException("PIPELINE_JOB_NOT_FOUND", "Pipeline job을 찾을 수 없습니다.");
    }
    String kind = reviewKindForStatus(job.getStatus());
    if (kind.isBlank()) {
      return new ReviewCheckpointView(pipelineJobId, job.getStatus(), null, List.of());
    }
    Optional<ReviewSession> session =
        reviewSessionRepository.findFirstByPipelineJobIdAndReviewKindOrderByOpenedAtDesc(
            pipelineJobId, kind);
    if (session.isEmpty()) {
      return new ReviewCheckpointView(pipelineJobId, job.getStatus(), null, List.of());
    }
    List<ReviewTaskView> tasks =
        reviewTaskRepository.findByReviewSessionIdOrderByIdAsc(session.get().getId()).stream()
            .map(
                task ->
                    new ReviewTaskView(
                        task.getId(),
                        task.getTargetType(),
                        task.getStatus(),
                        task.getPriority(),
                        task.getTitle(),
                        readJson(task.getTargetRefJson())))
            .toList();
    return new ReviewCheckpointView(
        pipelineJobId, job.getStatus(), session.get().getReviewKind(), tasks);
  }

  private CheckpointCallbackResult receiveCheckpoint(
      CheckpointCallbackCommand command,
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
      return new CheckpointCallbackResult("DUPLICATE_IGNORED", command.externalEventId());
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
    if (callbackSupportService.isProcessed(receipt)) {
      return new CheckpointCallbackResult("DUPLICATE_IGNORED", command.externalEventId());
    }
    return callbackSupportService.executeInTransactionOrMarkFailure(
        command.jobId(),
        command.externalEventId(),
        () -> processCheckpoint(command, reviewKind, artifactType, waitingStatus));
  }

  private CheckpointCallbackResult processCheckpoint(
      CheckpointCallbackCommand command,
      String reviewKind,
      String artifactType,
      String waitingStatus) {
    PipelineJob job = runningJob(command.jobId());
    OffsetDateTime now = callbackSupportService.now();
    JsonNode artifactPayloadNode = requireArtifactPayload(command.artifactPayload());
    String artifactPayload = toJson(artifactPayloadNode);
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
    reviewTaskRepository.saveAll(tasksFor(session.getId(), reviewKind, artifactPayloadNode, now));
    if (PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION.equals(waitingStatus)) {
      job.markAwaitingDomainConfirmation(summaryJson(command, reviewKind));
    } else {
      job.markAwaitingHumanFeedback(summaryJson(command, reviewKind));
    }
    callbackSupportService.savePipelineJobOrThrowConflict(job, command.jobId());
    callbackSupportService.markReceiptProcessed(command.externalEventId(), now);
    return new CheckpointCallbackResult("CREATED", command.externalEventId());
  }

  private List<ReviewTask> tasksFor(
      Long sessionId, String reviewKind, JsonNode artifactPayload, OffsetDateTime now) {
    List<ReviewTask> tasks = new ArrayList<>();
    String arrayName =
        ReviewSession.KIND_DOMAIN_CONFIRMATION.equals(reviewKind) ? "candidates" : "questions";
    JsonNode rows = artifactPayload.path(arrayName);
    if (!rows.isArray()) {
      return tasks;
    }
    for (JsonNode row : rows) {
      String title =
          ReviewSession.KIND_DOMAIN_CONFIRMATION.equals(reviewKind)
              ? text(row, "displayName")
              : text(row, "questionText");
      tasks.add(
          ReviewTask.create(
              sessionId,
              ReviewSession.KIND_DOMAIN_CONFIRMATION.equals(reviewKind)
                  ? ReviewTask.TARGET_DOMAIN_CANDIDATE
                  : ReviewTask.TARGET_FEEDBACK_PAIR,
              toJson(row),
              title.isBlank() ? titleFor(reviewKind) : title,
              text(row, "priority").isBlank() ? "NORMAL" : text(row, "priority"),
              "{}",
              now));
    }
    return tasks;
  }

  private void triggerReplay(
      PipelineJob parentJob,
      String runMode,
      String confirmedDomainProfileJson,
      String feedbackConstraintsJson,
      boolean skipFeedbackCheckpoint) {
    String upstreamManifestPath = upstreamManifestPath(parentJob);
    String dagRunId = "pipeline_job_" + parentJob.getId() + "_" + runMode.toLowerCase();
    try {
      triggerPort.trigger(
          new DomainPackGenerationTriggerCommand(
              parentJob.getWorkspaceId(),
              parentJob.getDatasetId(),
              parentJob.getId(),
              dagRunId,
              "",
              runMode,
              parentJob.getId(),
              upstreamManifestPath,
              null,
              null,
              confirmedDomainProfileJson,
              feedbackConstraintsJson,
              skipFeedbackCheckpoint));
      parentJob.markRunning(
          replaySummaryJson(
              runMode, upstreamManifestPath, confirmedDomainProfileJson, feedbackConstraintsJson));
      pipelineJobRepository.saveAndFlush(parentJob);
    } catch (AirflowTriggerFailedException ex) {
      failurePersistenceService.markFailed(parentJob, ex.getMessage(), OffsetDateTime.now(clock));
      throw ex;
    }
  }

  private JsonNode requireArtifactPayload(JsonNode artifactPayload) {
    if (artifactPayload == null || artifactPayload.isNull()) {
      throw new BadRequestException(
          "CHECKPOINT_ARTIFACT_PAYLOAD_REQUIRED", "artifactPayload는 필수입니다.");
    }
    return artifactPayload;
  }

  private String upstreamManifestPath(PipelineJob job) {
    JsonNode summary = readJson(job.getResultSummaryJson());
    String value = text(summary, FIELD_UPSTREAM_MANIFEST_PATH);
    if (!value.isBlank()) {
      return value;
    }
    value = text(summary, "upstream_manifest_path");
    if (!value.isBlank()) {
      return value;
    }
    JsonNode meta = latestArtifactPayload(job.getId(), ARTIFACT_DOMAIN_CANDIDATES);
    value = text(meta, FIELD_UPSTREAM_MANIFEST_PATH);
    if (!value.isBlank()) {
      return value;
    }
    throw new BadRequestException(
        "REPLAY_UPSTREAM_MISSING", "Replay upstream manifest path가 없습니다.");
  }

  private JsonNode latestArtifactPayload(Long pipelineJobId, String artifactType) {
    return pipelineArtifactRepository
        .findByPipelineJobIdAndArtifactTypeOrderByCreatedAtDesc(pipelineJobId, artifactType)
        .stream()
        .findFirst()
        .map(artifact -> readJson(artifact.getPayloadJson()))
        .orElse(objectMapper.createObjectNode());
  }

  private String latestArtifactJsonOrNull(Long pipelineJobId, String artifactType) {
    return pipelineArtifactRepository
        .findByPipelineJobIdAndArtifactTypeOrderByCreatedAtDesc(pipelineJobId, artifactType)
        .stream()
        .findFirst()
        .map(PipelineArtifact::getPayloadJson)
        .orElse(null);
  }

  private ReviewSession openSession(Long pipelineJobId, String kind, boolean requireOpen) {
    return reviewSessionRepository
        .findFirstByPipelineJobIdAndReviewKindOrderByOpenedAtDesc(pipelineJobId, kind)
        .filter(session -> !requireOpen || ReviewSession.STATUS_OPEN.equals(session.getStatus()))
        .orElseThrow(
            () -> new NotFoundException("REVIEW_SESSION_NOT_FOUND", "Review session을 찾을 수 없습니다."));
  }

  private ReviewTask openTaskForSession(
      ReviewSession session, Long reviewTaskId, String targetType) {
    ReviewTask task =
        reviewTaskRepository
            .findById(reviewTaskId)
            .orElseThrow(
                () -> new NotFoundException("REVIEW_TASK_NOT_FOUND", "Review task를 찾을 수 없습니다."));
    if (!session.getId().equals(task.getReviewSessionId())
        || !targetType.equals(task.getTargetType())
        || !ReviewTask.STATUS_OPEN.equals(task.getStatus())) {
      throw new NotFoundException("REVIEW_TASK_NOT_FOUND", "Review task를 찾을 수 없습니다.");
    }
    return task;
  }

  private List<ReviewTask> openTasksForSession(ReviewSession session, String targetType) {
    return reviewTaskRepository.findByReviewSessionIdOrderByIdAsc(session.getId()).stream()
        .filter(task -> targetType.equals(task.getTargetType()))
        .filter(task -> ReviewTask.STATUS_OPEN.equals(task.getStatus()))
        .toList();
  }

  private PipelineJob reviewJob(
      Long workspaceId, Long pipelineJobId, Long userId, String requiredStatus) {
    PipelineJob job = runningJob(pipelineJobId);
    if (!workspaceId.equals(job.getWorkspaceId())) {
      throw new NotFoundException("PIPELINE_JOB_NOT_FOUND", "Pipeline job을 찾을 수 없습니다.");
    }
    if (!workspaceMembershipPort.hasAnyRole(workspaceId, userId, ALLOWED_REVIEW_ROLES)) {
      throw new PipelineJobWorkspaceAccessDeniedException(
          "Pipeline review checkpoint 접근 권한이 없습니다.");
    }
    if (requiredStatus != null && !requiredStatus.equals(job.getStatus())) {
      throw new BadRequestException(
          "REVIEW_CHECKPOINT_NOT_WAITING", "Pipeline job이 해당 리뷰 체크포인트 대기 상태가 아닙니다.");
    }
    return job;
  }

  private void requireWorkspace(ReviewSession session, Long workspaceId) {
    if (!workspaceId.equals(session.getWorkspaceId())) {
      throw new NotFoundException("REVIEW_SESSION_NOT_FOUND", "Review session을 찾을 수 없습니다.");
    }
  }

  private PipelineJob runningJob(Long jobId) {
    return pipelineJobRepository
        .findById(jobId)
        .orElseThrow(() -> new PipelineJobNotFoundException(jobId));
  }

  private String titleFor(String reviewKind) {
    return ReviewSession.KIND_DOMAIN_CONFIRMATION.equals(reviewKind) ? "상담 도메인 확정" : "클러스터링 피드백";
  }

  private String reviewKindForStatus(String status) {
    if (PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION.equals(status)) {
      return ReviewSession.KIND_DOMAIN_CONFIRMATION;
    }
    if (PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK.equals(status)) {
      return ReviewSession.KIND_HUMAN_FEEDBACK;
    }
    return "";
  }

  private String summaryJson(CheckpointCallbackCommand command, String reviewKind) {
    ObjectNode summary = objectMapper.createObjectNode();
    summary.put("reviewKind", reviewKind);
    summary.put(FIELD_UPSTREAM_MANIFEST_PATH, command.upstreamManifestPath());
    summary.put("artifactPath", command.artifactPath());
    return toJson(summary);
  }

  private String replaySummaryJson(
      String runMode,
      String upstreamManifestPath,
      String confirmedDomainProfileJson,
      String feedbackConstraintsJson) {
    ObjectNode summary = objectMapper.createObjectNode();
    summary.put("runMode", runMode);
    summary.put(FIELD_UPSTREAM_MANIFEST_PATH, upstreamManifestPath);
    if (confirmedDomainProfileJson != null) {
      summary.set("confirmedDomainProfile", readJson(confirmedDomainProfileJson));
    }
    if (feedbackConstraintsJson != null) {
      summary.set("feedbackConstraints", readJson(feedbackConstraintsJson));
    }
    return toJson(summary);
  }

  private String normalizeFeedbackDecision(String decisionType) {
    String normalized = decisionType == null ? "" : decisionType.trim().toLowerCase();
    if (normalized.equals("same") || normalized.equals("must_link")) {
      return "must_link";
    }
    if (normalized.equals("different") || normalized.equals("cannot_link")) {
      return "cannot_link";
    }
    return "unsure";
  }

  private ObjectNode decisionPayload(String decisionType, JsonNode question) {
    ObjectNode payload = objectMapper.createObjectNode();
    payload.put("decisionType", decisionType);
    payload.set("question", question);
    return payload;
  }

  private String toJson(JsonNode node) {
    try {
      return objectMapper.writeValueAsString(node);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("JSON serialization failed.", ex);
    }
  }

  private JsonNode readJson(String value) {
    try {
      return objectMapper.readTree(value == null || value.isBlank() ? "{}" : value);
    } catch (JsonProcessingException ex) {
      throw new BadRequestException("INVALID_JSON", "JSON payload가 올바르지 않습니다.", ex);
    }
  }

  private String text(JsonNode node, String fieldName) {
    JsonNode value = node.path(fieldName);
    return value.isMissingNode() || value.isNull() ? "" : value.asText("");
  }

  private double number(JsonNode node, String fieldName) {
    JsonNode value = node.path(fieldName);
    return value.isNumber() ? value.asDouble() : 0.0;
  }

  public record CheckpointCallbackCommand(
      Long jobId,
      String providedWebhookSecret,
      String externalEventId,
      String dagId,
      String dagRunId,
      String runMode,
      String parentPipelineJobId,
      String upstreamManifestPath,
      String artifactPath,
      JsonNode artifactPayload,
      String requestHeadersJson,
      String requestBodyJson) {}

  public record CheckpointCallbackResult(String status, String externalEventId) {}

  public record ConfirmDomainCommand(
      Long workspaceId, Long pipelineJobId, Long reviewTaskId, Long userId, String reason) {}

  public record SubmitFeedbackCommand(
      Long workspaceId, Long pipelineJobId, Long userId, List<FeedbackDecisionInput> decisions) {}

  public record FeedbackDecisionInput(Long reviewTaskId, String decisionType, String reason) {}

  public record ReviewCheckpointResult(Long reviewSessionId, String status) {
    public static ReviewCheckpointResult of(Long reviewSessionId, String status) {
      return new ReviewCheckpointResult(reviewSessionId, status);
    }
  }

  public record ReviewCheckpointView(
      Long pipelineJobId, String pipelineStatus, String reviewKind, List<ReviewTaskView> tasks) {}

  public record ReviewTaskView(
      Long id, String targetType, String status, String priority, String title, JsonNode payload) {}
}
