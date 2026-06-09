package com.init.review.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.application.WorkspaceMembershipPort;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
import com.init.pipelinejob.application.exception.PipelineJobWorkspaceAccessDeniedException;
import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.model.PipelineJob;
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
import com.init.shared.application.quota.WorkspaceQuotaValidator;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
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
  private static final String ARTIFACT_CONFIRMED_DOMAIN_PROFILE = "CONFIRMED_DOMAIN_PROFILE";
  private static final String ARTIFACT_FEEDBACK_CONSTRAINTS = "FEEDBACK_CONSTRAINTS";
  private static final String FIELD_CONFIDENCE = "confidence";
  private static final String FIELD_DISPLAY_NAME = "displayName";
  private static final String FIELD_DESCRIPTION = "description";
  private static final Set<String> ALLOWED_REVIEW_ROLES = Set.of("OWNER", "ADMIN", "OPERATOR");

  private final PipelineJobRepository pipelineJobRepository;
  private final PipelineArtifactRepository pipelineArtifactRepository;
  private final ReviewSessionRepository reviewSessionRepository;
  private final ReviewTaskRepository reviewTaskRepository;
  private final ReviewDecisionRepository reviewDecisionRepository;
  private final PipelineReviewCheckpointCallbackProcessor callbackProcessor;
  private final PipelineReviewReplayOrchestrator replayOrchestrator;
  private final WorkspaceMembershipPort workspaceMembershipPort;
  private final WorkspaceQuotaValidator workspaceQuotaValidator;
  private final PipelineReviewCheckpointJsonSupport jsonSupport;
  private final Clock clock;

  public PipelineReviewCheckpointUseCase(
      PipelineJobRepository pipelineJobRepository,
      PipelineArtifactRepository pipelineArtifactRepository,
      ReviewSessionRepository reviewSessionRepository,
      ReviewTaskRepository reviewTaskRepository,
      ReviewDecisionRepository reviewDecisionRepository,
      PipelineReviewCheckpointCallbackProcessor callbackProcessor,
      PipelineReviewReplayOrchestrator replayOrchestrator,
      WorkspaceMembershipPort workspaceMembershipPort,
      WorkspaceQuotaValidator workspaceQuotaValidator,
      PipelineReviewCheckpointJsonSupport jsonSupport,
      Clock clock) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.pipelineArtifactRepository = pipelineArtifactRepository;
    this.reviewSessionRepository = reviewSessionRepository;
    this.reviewTaskRepository = reviewTaskRepository;
    this.reviewDecisionRepository = reviewDecisionRepository;
    this.callbackProcessor = callbackProcessor;
    this.replayOrchestrator = replayOrchestrator;
    this.workspaceMembershipPort = workspaceMembershipPort;
    this.workspaceQuotaValidator = workspaceQuotaValidator;
    this.jsonSupport = jsonSupport;
    this.clock = clock;
  }

  @Transactional
  public CheckpointCallbackResult receiveDomainConfirmationCheckpoint(
      CheckpointCallbackCommand command) {
    return callbackProcessor.receiveDomainConfirmationCheckpoint(command);
  }

  @Transactional
  public CheckpointCallbackResult receiveHumanFeedbackCheckpoint(
      CheckpointCallbackCommand command) {
    return callbackProcessor.receiveHumanFeedbackCheckpoint(command);
  }

  @Transactional
  public ReviewCheckpointResult confirmDomain(ConfirmDomainCommand command) {
    PipelineJob job =
        reviewJob(
            command.workspaceId(),
            command.pipelineJobId(),
            command.userId(),
            PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION);
    workspaceQuotaValidator.assertPipelineRunAllowed(command.workspaceId());
    ReviewSession session =
        openSession(command.pipelineJobId(), ReviewSession.KIND_DOMAIN_CONFIRMATION, true);
    requireWorkspace(session, command.workspaceId());
    ReviewTask selectedTask =
        openTaskForSession(session, command.reviewTaskId(), ReviewTask.TARGET_DOMAIN_CANDIDATE);
    JsonNode candidate = jsonSupport.readJson(selectedTask.getTargetRefJson());
    ObjectNode profile = buildConfirmedDomainProfile(candidate, selectedTask, command);

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
            jsonSupport.toJson(profile),
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
                jsonSupport.toJson(profile),
                now));
    replayOrchestrator.triggerDomainConfirmedReplay(job, artifact.getPayloadJson());
    return ReviewCheckpointResult.of(session.getId(), "DOMAIN_CONFIRMED_REPLAY_TRIGGERED");
  }

  /**
   * 선택한 candidate payload를 기본값으로 두고 operator override를 병합해 {@code confirmed-domain-profile.v1}을
   * 만든다. override 필드가 비어 있으면 candidate 값을 유지하므로 candidate 선택만 보내는 기존 요청도 동일하게 동작한다.
   */
  private ObjectNode buildConfirmedDomainProfile(
      JsonNode candidate, ReviewTask selectedTask, ConfirmDomainCommand command) {
    DomainProfileOverride override =
        command.profileOverride() == null
            ? DomainProfileOverride.empty()
            : command.profileOverride();
    String candidateDisplayName = jsonSupport.text(candidate, FIELD_DISPLAY_NAME);
    ObjectNode profile = jsonSupport.objectNode();
    profile.put("schemaVersion", "confirmed-domain-profile.v1");
    profile.put("candidateId", jsonSupport.text(candidate, "candidateId"));
    profile.put(
        "confirmedDomain", overrideOrFallback(override.confirmedDomain(), candidateDisplayName));
    profile.put(
        FIELD_DISPLAY_NAME, overrideOrFallback(override.displayName(), candidateDisplayName));
    profile.put(
        FIELD_DESCRIPTION,
        overrideOrFallback(override.description(), jsonSupport.text(candidate, FIELD_DESCRIPTION)));
    profile.put(FIELD_CONFIDENCE, jsonSupport.number(candidate, FIELD_CONFIDENCE));
    profile.set(
        "evidenceTerms", mergeTermList(override.evidenceTerms(), candidate.path("evidenceTerms")));
    profile.set("evidenceConversationIds", candidate.path("evidenceConversationIds"));
    profile.set(
        "domainLexicon",
        mergeTermList(override.domainLexicon(), candidate.path("suggestedDomainLexicon")));
    profile.set("exclusionTerms", sanitizeTerms(override.exclusionTerms()));
    profile.put("sourceReviewTaskId", selectedTask.getId());
    profile.put("confirmedBy", command.userId());
    return profile;
  }

  private String overrideOrFallback(String overrideValue, String candidateValue) {
    return overrideValue != null && !overrideValue.isBlank()
        ? overrideValue.trim()
        : candidateValue;
  }

  /** override list가 주어지면(빈 list 포함, 의도적 비움 허용) 그것을, 아니면 candidate array를 사용한다. */
  private ArrayNode mergeTermList(List<String> override, JsonNode candidateTerms) {
    if (override != null) {
      return sanitizeTerms(override);
    }
    ArrayNode array = jsonSupport.arrayNode();
    if (candidateTerms != null && candidateTerms.isArray()) {
      for (JsonNode term : candidateTerms) {
        String value = term.asText("").trim();
        if (!value.isBlank()) {
          array.add(value);
        }
      }
    }
    return array;
  }

  private ArrayNode sanitizeTerms(List<String> terms) {
    ArrayNode array = jsonSupport.arrayNode();
    if (terms != null) {
      for (String term : terms) {
        if (term != null && !term.isBlank()) {
          array.add(term.trim());
        }
      }
    }
    return array;
  }

  @Transactional
  public ReviewCheckpointResult submitFeedback(SubmitFeedbackCommand command) {
    PipelineJob job =
        reviewJob(
            command.workspaceId(),
            command.pipelineJobId(),
            command.userId(),
            PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK);
    workspaceQuotaValidator.assertPipelineRunAllowed(command.workspaceId());
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
    ArrayNode constraints = jsonSupport.arrayNode();
    OffsetDateTime now = OffsetDateTime.now(clock);
    for (FeedbackDecisionInput decision : decisionsByTaskId.values()) {
      ReviewTask task = openFeedbackTasks.get(decision.reviewTaskId());
      JsonNode question = jsonSupport.readJson(task.getTargetRefJson());
      task.resolve(command.userId(), now);
      reviewTaskRepository.save(task);
      FeedbackDecisionMapping decisionMapping =
          mapFeedbackDecision(decision.decisionType(), question);
      ReviewDecision savedDecision =
          ReviewDecision.create(
              session.getId(),
              ReviewTask.TARGET_FEEDBACK_PAIR,
              task.getId(),
              decisionMapping.decisionType(),
              decision.reason(),
              command.userId(),
              jsonSupport.toJson(decisionPayload(decisionMapping, question)),
              now);
      savedDecision = reviewDecisionRepository.save(savedDecision);
      String intentConstraintType = decisionMapping.constraintType();
      String workflowConstraintType = workflowConstraintType(decisionMapping);
      if (!intentConstraintType.isBlank()) {
        addConstraint(constraints, question, intentConstraintType, "intent", task, savedDecision);
      } else if (!workflowConstraintType.isBlank()) {
        addConstraint(
            constraints, question, workflowConstraintType, "workflow", task, savedDecision);
      }
    }
    ObjectNode payload = jsonSupport.objectNode();
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
                jsonSupport.toJson(payload),
                now));
    replayOrchestrator.triggerFeedbackReplay(job, artifact.getPayloadJson());
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
                        jsonSupport.readJson(task.getTargetRefJson())))
            .toList();
    return new ReviewCheckpointView(
        pipelineJobId, job.getStatus(), session.get().getReviewKind(), tasks);
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

  private String reviewKindForStatus(String status) {
    if (PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION.equals(status)) {
      return ReviewSession.KIND_DOMAIN_CONFIRMATION;
    }
    if (PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK.equals(status)) {
      return ReviewSession.KIND_HUMAN_FEEDBACK;
    }
    return "";
  }

  private String normalizeFeedbackDecision(String decisionType) {
    String normalized = decisionType == null ? "" : decisionType.trim().toLowerCase(Locale.ROOT);
    return switch (normalized) {
      case "same", "must_link" -> "must_link";
      case "different", "cannot_link" -> "cannot_link";
      case "same_workflow", "same_intent_separate_workflow", "different_intent" -> normalized;
      default -> "unsure";
    };
  }

  private FeedbackDecisionMapping mapFeedbackDecision(String decisionType, JsonNode question) {
    String normalizedDecision = normalizeFeedbackDecision(decisionType);
    JsonNode option = answerOption(question, normalizedDecision);
    String questionType = jsonSupport.text(question, "questionType");
    String questionDecisionScope = jsonSupport.text(question, "decisionScope");
    String decisionScope =
        firstPresent(
            jsonSupport.text(option, "decisionScope"),
            scopeForDecision(normalizedDecision, questionType, questionDecisionScope));
    String constraintType =
        firstPresent(
            jsonSupport.text(option, "constraintType"),
            legacyIntentConstraint(normalizedDecision, questionType));
    if (!"intent".equals(decisionScope)) {
      constraintType = "";
    }
    if (!constraintType.equals("must_link") && !constraintType.equals("cannot_link")) {
      constraintType = "";
    }
    return new FeedbackDecisionMapping(
        normalizedDecision, decisionScope, constraintType, questionType, questionDecisionScope);
  }

  private JsonNode answerOption(JsonNode question, String decisionType) {
    JsonNode options = question.path("answerOptions");
    if (!options.isArray()) {
      return jsonSupport.objectNode();
    }
    for (JsonNode option : options) {
      if (decisionType.equals(jsonSupport.text(option, "value"))) {
        return option;
      }
    }
    return jsonSupport.objectNode();
  }

  private String scopeForDecision(
      String decisionType, String questionType, String questionDecisionScope) {
    if ("unsure".equals(decisionType)) {
      return "none";
    }
    if ("different_intent".equals(decisionType)) {
      return "intent";
    }
    if ("WORKFLOW_BOUNDARY".equals(questionType)) {
      return firstPresent(questionDecisionScope, "workflow");
    }
    return switch (decisionType) {
      case "must_link", "cannot_link" -> "intent";
      case "same_workflow", "same_intent_separate_workflow" -> "workflow";
      default -> firstPresent(questionDecisionScope, "none");
    };
  }

  private void addConstraint(
      ArrayNode constraints,
      JsonNode question,
      String type,
      String scope,
      ReviewTask task,
      ReviewDecision savedDecision) {
    ObjectNode constraint = constraints.addObject();
    constraint.put("sourceId", jsonSupport.text(question, "sourceId"));
    constraint.put("targetId", jsonSupport.text(question, "targetId"));
    constraint.put("type", type);
    constraint.put("confidence", 1.0);
    constraint.put("scope", scope);
    constraint.put("reviewTaskId", task.getId());
    constraint.put("decisionId", savedDecision.getId());
  }

  private String workflowConstraintType(FeedbackDecisionMapping decisionMapping) {
    if (!"workflow".equals(decisionMapping.decisionScope())) {
      return "";
    }
    return switch (decisionMapping.decisionType()) {
      case "same_workflow" -> "same_workflow";
      case "same_intent_separate_workflow" -> "separate_workflow";
      default -> "";
    };
  }

  private String legacyIntentConstraint(String decisionType, String questionType) {
    if ("WORKFLOW_BOUNDARY".equals(questionType) && !"different_intent".equals(decisionType)) {
      return "";
    }
    return switch (decisionType) {
      case "must_link" -> "must_link";
      case "cannot_link", "different_intent" -> "cannot_link";
      default -> "";
    };
  }

  private String firstPresent(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value;
      }
    }
    return "";
  }

  private ObjectNode decisionPayload(FeedbackDecisionMapping decisionMapping, JsonNode question) {
    ObjectNode payload = jsonSupport.objectNode();
    payload.put("decisionType", decisionMapping.decisionType());
    payload.put("decisionScope", decisionMapping.decisionScope());
    payload.put("questionType", decisionMapping.questionType());
    payload.put("questionDecisionScope", decisionMapping.questionDecisionScope());
    if (!decisionMapping.constraintType().isBlank()) {
      payload.put("constraintType", decisionMapping.constraintType());
    }
    payload.set("question", question);
    return payload;
  }

  private record FeedbackDecisionMapping(
      String decisionType,
      String decisionScope,
      String constraintType,
      String questionType,
      String questionDecisionScope) {}

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
      Long workspaceId,
      Long pipelineJobId,
      Long reviewTaskId,
      Long userId,
      String reason,
      DomainProfileOverride profileOverride) {}

  /** 운영자가 candidate를 다듬은 값. 모든 필드 optional이며 null이면 candidate 값을 유지한다(하위호환). */
  public record DomainProfileOverride(
      String confirmedDomain,
      String displayName,
      String description,
      List<String> domainLexicon,
      List<String> evidenceTerms,
      List<String> exclusionTerms) {
    public static DomainProfileOverride empty() {
      return new DomainProfileOverride(null, null, null, null, null, null);
    }
  }

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
