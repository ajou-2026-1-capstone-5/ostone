package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.review.domain.model.ReviewTask;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.SimulationCandidatePatchViewMapper.PatchView;
import com.init.workflowruntime.application.command.ApproveSimulationImprovementCandidateCommand;
import com.init.workflowruntime.application.command.CreateSimulationImprovementCandidateCommand;
import com.init.workflowruntime.application.command.RejectSimulationImprovementCandidateCommand;
import com.init.workflowruntime.application.command.UpdateSimulationImprovementCandidateStatusCommand;
import com.init.workflowruntime.application.dto.SimulationImprovementCandidatePageResponse;
import com.init.workflowruntime.application.dto.SimulationImprovementCandidateResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
import com.init.workflowruntime.domain.InvalidStructuralPatchException;
import com.init.workflowruntime.domain.SimulationFeedback;
import com.init.workflowruntime.domain.SimulationFeedbackRepository;
import com.init.workflowruntime.domain.SimulationFeedbackStatus;
import com.init.workflowruntime.domain.SimulationFeedbackType;
import com.init.workflowruntime.domain.SimulationImprovementCandidate;
import com.init.workflowruntime.domain.SimulationImprovementCandidateDraft;
import com.init.workflowruntime.domain.SimulationImprovementCandidateRepository;
import com.init.workflowruntime.domain.SimulationImprovementCandidateStatus;
import com.init.workflowruntime.domain.SimulationImprovementCandidateTargetType;
import com.init.workflowruntime.domain.SimulationImprovementCandidateType;
import com.init.workflowruntime.domain.SimulationPatchValidationStatus;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SimulationImprovementCandidateService {

  private static final int DEFAULT_PAGE = 0;
  private static final int DEFAULT_PAGE_SIZE = 20;
  private static final int MAX_PAGE_SIZE = 100;
  private static final int GENERATED_SUMMARY_MAX_LENGTH = 2000;

  private final SimulationFeedbackRepository feedbackRepository;
  private final SimulationImprovementCandidateRepository candidateRepository;
  private final ChatSessionRepository chatSessionRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final SimulationImprovementCandidateReviewTaskService reviewTaskService;
  private final SimulationImprovementCandidateDecisionService decisionService;
  private final SimulationStructuralPatchGenerationService structuralPatchGenerationService;
  private final SimulationCandidatePatchViewMapper patchViewMapper;
  private final ObjectMapper objectMapper;
  private final boolean structuralPatchEnabled;

  public SimulationImprovementCandidateService(
      SimulationFeedbackRepository feedbackRepository,
      SimulationImprovementCandidateRepository candidateRepository,
      ChatSessionRepository chatSessionRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      SimulationImprovementCandidateReviewTaskService reviewTaskService,
      SimulationImprovementCandidateDecisionService decisionService,
      SimulationStructuralPatchGenerationService structuralPatchGenerationService,
      SimulationCandidatePatchViewMapper patchViewMapper,
      ObjectMapper objectMapper,
      @Value("${app.simulation.structural-patch.enabled:false}") boolean structuralPatchEnabled) {
    this.feedbackRepository = feedbackRepository;
    this.candidateRepository = candidateRepository;
    this.chatSessionRepository = chatSessionRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.reviewTaskService = reviewTaskService;
    this.decisionService = decisionService;
    this.structuralPatchGenerationService = structuralPatchGenerationService;
    this.patchViewMapper = patchViewMapper;
    this.objectMapper = objectMapper;
    this.structuralPatchEnabled = structuralPatchEnabled;
  }

  @Transactional
  public SimulationImprovementCandidateResponse createFromFeedback(
      CreateSimulationImprovementCandidateCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    SimulationFeedback feedback = findFeedbackForUpdate(command.feedbackId());
    validateFeedbackWorkspace(command.workspaceId(), feedback);

    return candidateRepository
        .findByFeedbackId(feedback.getId())
        .map(this::toResponse)
        .orElseGet(() -> createNewCandidate(command, feedback));
  }

  public SimulationImprovementCandidatePageResponse listCandidates(
      Long workspaceId, Long userId, String status, int page, int size) {
    validateWorkspaceMembership(workspaceId, userId);
    SimulationImprovementCandidateStatus parsedStatus = parseCandidateStatus(status);
    DomainPageRequest pageRequest = normalizedPageRequest(page, size);
    DomainPage<SimulationImprovementCandidate> candidatePage =
        parsedStatus == null
            ? candidateRepository.findByWorkspaceId(workspaceId, pageRequest)
            : candidateRepository.findByWorkspaceIdAndStatus(
                workspaceId, parsedStatus, pageRequest);
    return SimulationImprovementCandidatePageResponse.from(candidatePage, this::toResponse);
  }

  public SimulationImprovementCandidateResponse getCandidate(
      Long workspaceId, Long userId, Long candidateId) {
    validateWorkspaceMembership(workspaceId, userId);
    SimulationImprovementCandidate candidate = findCandidate(candidateId);
    validateCandidateWorkspace(workspaceId, candidate);
    return toResponse(candidate);
  }

  @Transactional
  public SimulationImprovementCandidateResponse updateStatus(
      UpdateSimulationImprovementCandidateStatusCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    SimulationImprovementCandidate candidate = findCandidate(command.candidateId());
    validateCandidateWorkspace(command.workspaceId(), candidate);
    SimulationImprovementCandidateStatus nextStatus =
        parseRequiredCandidateStatus(command.status());
    if (nextStatus != SimulationImprovementCandidateStatus.READY_FOR_REVIEW) {
      throw new BadRequestException(
          "INVALID_CANDIDATE_REVIEW_STATUS",
          "READY_FOR_REVIEW 전이만 상태 변경 endpoint에서 지원합니다. 승인/반려 endpoint를 사용하세요.");
    }
    ReviewTask task = reviewTaskService.ensureReviewTask(candidate, command.userId());
    candidate.submitForReview(task.getReviewSessionId(), task.getId());
    return toResponse(candidateRepository.save(candidate));
  }

  @Transactional
  public SimulationImprovementCandidateResponse approve(
      ApproveSimulationImprovementCandidateCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    SimulationImprovementCandidate candidate = findCandidate(command.candidateId());
    validateCandidateWorkspace(command.workspaceId(), candidate);
    PatchView patchView = patchViewMapper.map(candidate.getDraftPatchJson());
    if (patchView.validationStatus() == SimulationPatchValidationStatus.INVALID) {
      throw new InvalidStructuralPatchException("승인할 수 없는 INVALID 구조 패치입니다.");
    }
    SimulationFeedback feedback = findFeedbackForUpdate(candidate.getFeedbackId());
    validateFeedbackWorkspace(command.workspaceId(), feedback);
    SimulationImprovementCandidate approved =
        decisionService.approve(
            command.workspaceId(), command.userId(), command.reason(), candidate, feedback);
    return SimulationImprovementCandidateResponse.from(
        approved, patchViewMapper.map(approved.getDraftPatchJson()));
  }

  @Transactional
  public SimulationImprovementCandidateResponse reject(
      RejectSimulationImprovementCandidateCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    SimulationImprovementCandidate candidate = findCandidate(command.candidateId());
    validateCandidateWorkspace(command.workspaceId(), candidate);
    SimulationFeedback feedback = findFeedbackForUpdate(candidate.getFeedbackId());
    validateFeedbackWorkspace(command.workspaceId(), feedback);
    return toResponse(
        decisionService.reject(command.userId(), command.reason(), candidate, feedback));
  }

  private SimulationImprovementCandidateResponse createNewCandidate(
      CreateSimulationImprovementCandidateCommand command, SimulationFeedback feedback) {
    if (feedback.getStatus() != SimulationFeedbackStatus.OPEN) {
      throw new BadRequestException(
          "SIMULATION_FEEDBACK_NOT_OPEN", "OPEN 피드백에서만 개선 후보를 생성할 수 있습니다.");
    }
    ChatSession session = findSimulationSession(command.workspaceId(), feedback.getChatSessionId());
    SimulationImprovementCandidate candidate =
        SimulationImprovementCandidate.create(
            feedback.getWorkspaceId(),
            session.getDomainPackVersionId(),
            feedback.getId(),
            feedback.getChatSessionId(),
            feedback.getChatMessageId(),
            draftFrom(command, feedback),
            command.userId());
    candidate.defineDraftPatch(buildDraftPatch(candidate, feedback, session));
    SimulationImprovementCandidate saved = candidateRepository.save(candidate);
    feedback.markCandidateCreated();
    feedbackRepository.save(feedback);
    return toResponse(saved);
  }

  private SimulationImprovementCandidateResponse toResponse(
      SimulationImprovementCandidate candidate) {
    PatchView patchView = patchViewMapper.map(candidate.getDraftPatchJson());
    return SimulationImprovementCandidateResponse.from(candidate, patchView);
  }

  private String buildDraftPatch(
      SimulationImprovementCandidate candidate, SimulationFeedback feedback, ChatSession session) {
    if (!structuralPatchEnabled) {
      return buildDescriptionPatchJson(candidate);
    }
    SimulationStructuralPatchGenerationResult result =
        structuralPatchGenerationService.generate(feedback, session);
    if (result.isSuccess()) {
      return result.patchJson();
    }
    return buildGenerationFailureEnvelope(candidate, result);
  }

  private String buildDescriptionPatchJson(SimulationImprovementCandidate candidate) {
    return toJson(buildDescriptionPatchNode(candidate));
  }

  private ObjectNode buildDescriptionPatchNode(SimulationImprovementCandidate candidate) {
    ObjectNode root = objectMapper.createObjectNode();
    root.put("schemaVersion", "simulation-candidate-draft-patch.v1");
    root.put("operation", "UPDATE_DESCRIPTION");
    root.put("targetElementType", candidate.getTargetElementType().name());
    if (candidate.getTargetElementId() != null) {
      root.put("targetElementId", candidate.getTargetElementId());
    }
    if (candidate.getTargetElementKey() != null) {
      root.put("targetElementKey", candidate.getTargetElementKey());
    }
    root.put("beforeSummary", candidate.getBeforeSummary());
    root.put("afterSummary", candidate.getAfterSummary());
    root.put("evidenceSummary", candidate.getEvidenceSummary());
    return root;
  }

  private String buildGenerationFailureEnvelope(
      SimulationImprovementCandidate candidate, SimulationStructuralPatchGenerationResult result) {
    ObjectNode root = objectMapper.createObjectNode();
    root.put("schemaVersion", "simulation-structural-patch-generation.v1");
    root.put("status", result.status().name());
    root.put("summary", result.summary());
    if (result.message() != null) {
      root.put("message", result.message());
    }
    root.set("descriptionPatch", buildDescriptionPatchNode(candidate));
    return toJson(root);
  }

  private String toJson(ObjectNode node) {
    try {
      return objectMapper.writeValueAsString(node);
    } catch (JsonProcessingException e) {
      throw new BadRequestException("JSON_SERIALIZATION_FAILED", "review payload 직렬화에 실패했습니다.", e);
    }
  }

  private SimulationImprovementCandidateDraft draftFrom(
      CreateSimulationImprovementCandidateCommand command, SimulationFeedback feedback) {
    SimulationImprovementCandidateType candidateType =
        inferCandidateType(feedback.getFeedbackType());
    SimulationImprovementCandidateTargetType targetType =
        command.targetElementType() == null || command.targetElementType().isBlank()
            ? inferTargetType(candidateType)
            : parseTargetType(command.targetElementType());
    return new SimulationImprovementCandidateDraft(
        candidateType,
        targetType,
        command.targetElementId(),
        command.targetElementKey(),
        defaultText(command.beforeSummary(), feedback.getDescription()),
        defaultText(command.afterSummary(), feedback.getExpectedBehavior()),
        limitGeneratedSummary(
            "simulation feedback #"
                + feedback.getId()
                + " (session #"
                + feedback.getChatSessionId()
                + evidenceTurnSuffix(feedback)
                + "): "
                + feedback.getDescription()));
  }

  private SimulationImprovementCandidateType inferCandidateType(
      SimulationFeedbackType feedbackType) {
    return switch (feedbackType) {
      case INTENT_MISMATCH -> SimulationImprovementCandidateType.INTENT_DESCRIPTION_EXAMPLE;
      case MISSING_SLOT_QUESTION -> SimulationImprovementCandidateType.SLOT_QUESTION;
      case POLICY_CONDITION_MISSING -> SimulationImprovementCandidateType.POLICY_CONDITION;
      case RISK_HANDOFF_REQUIRED -> SimulationImprovementCandidateType.HANDOFF_CONDITION;
      case WORKFLOW_BRANCH_ERROR -> SimulationImprovementCandidateType.WORKFLOW_STATE_TRANSITION;
      case INAPPROPRIATE_RESPONSE -> SimulationImprovementCandidateType.RESPONSE_COPY;
      case OTHER -> SimulationImprovementCandidateType.OTHER;
    };
  }

  private SimulationImprovementCandidateTargetType inferTargetType(
      SimulationImprovementCandidateType candidateType) {
    return switch (candidateType) {
      case INTENT_DESCRIPTION_EXAMPLE -> SimulationImprovementCandidateTargetType.INTENT;
      case SLOT_QUESTION -> SimulationImprovementCandidateTargetType.SLOT;
      case POLICY_CONDITION -> SimulationImprovementCandidateTargetType.POLICY;
      case RISK_RULE -> SimulationImprovementCandidateTargetType.RISK_RULE;
      case WORKFLOW_STATE_TRANSITION -> SimulationImprovementCandidateTargetType.WORKFLOW;
      case HANDOFF_CONDITION -> SimulationImprovementCandidateTargetType.HANDOFF;
      case RESPONSE_COPY -> SimulationImprovementCandidateTargetType.RESPONSE;
      case OTHER -> SimulationImprovementCandidateTargetType.UNKNOWN;
    };
  }

  private SimulationFeedback findFeedbackForUpdate(Long feedbackId) {
    return feedbackRepository
        .findByIdForUpdate(feedbackId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "SIMULATION_FEEDBACK_NOT_FOUND",
                    "Simulation feedback not found: " + feedbackId));
  }

  private SimulationImprovementCandidate findCandidate(Long candidateId) {
    return candidateRepository
        .findById(candidateId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "SIMULATION_IMPROVEMENT_CANDIDATE_NOT_FOUND",
                    "Simulation improvement candidate not found: " + candidateId));
  }

  private ChatSession findSimulationSession(Long workspaceId, Long sessionId) {
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "SIMULATION_SESSION_NOT_FOUND",
                        "Simulation session not found: " + sessionId));
    if (!workspaceId.equals(session.getWorkspaceId())
        || !SimulationService.SIMULATION_CHANNEL.equals(session.getChannel())) {
      throw new NotFoundException(
          "SIMULATION_SESSION_NOT_FOUND", "Simulation session not found: " + sessionId);
    }
    return session;
  }

  private void validateFeedbackWorkspace(Long workspaceId, SimulationFeedback feedback) {
    if (!workspaceId.equals(feedback.getWorkspaceId())) {
      throw new NotFoundException(
          "SIMULATION_FEEDBACK_NOT_FOUND", "Simulation feedback not found: " + feedback.getId());
    }
  }

  private void validateCandidateWorkspace(
      Long workspaceId, SimulationImprovementCandidate candidate) {
    if (!workspaceId.equals(candidate.getWorkspaceId())) {
      throw new NotFoundException(
          "SIMULATION_IMPROVEMENT_CANDIDATE_NOT_FOUND",
          "Simulation improvement candidate not found: " + candidate.getId());
    }
  }

  private void validateWorkspaceMembership(Long workspaceId, Long userId) {
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));
  }

  private SimulationImprovementCandidateStatus parseCandidateStatus(String status) {
    if (status == null || status.isBlank()) {
      return null;
    }
    return parseRequiredCandidateStatus(status);
  }

  private SimulationImprovementCandidateStatus parseRequiredCandidateStatus(String status) {
    if (status == null || status.isBlank()) {
      throw new BadRequestException("INVALID_CANDIDATE_STATUS", "후보 상태는 필수입니다.");
    }
    try {
      return SimulationImprovementCandidateStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
    } catch (IllegalArgumentException e) {
      throw new BadRequestException("INVALID_CANDIDATE_STATUS", "지원하지 않는 후보 상태입니다: " + status);
    }
  }

  private SimulationImprovementCandidateTargetType parseTargetType(String targetType) {
    try {
      return SimulationImprovementCandidateTargetType.valueOf(
          targetType.trim().toUpperCase(Locale.ROOT));
    } catch (IllegalArgumentException e) {
      throw new BadRequestException(
          "INVALID_CANDIDATE_TARGET_TYPE", "지원하지 않는 변경 대상 유형입니다: " + targetType);
    }
  }

  private DomainPageRequest normalizedPageRequest(int page, int size) {
    int normalizedPage = Math.max(DEFAULT_PAGE, page);
    int normalizedSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(MAX_PAGE_SIZE, Math.max(1, size));
    return new DomainPageRequest(normalizedPage, normalizedSize);
  }

  private String defaultText(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

  private String evidenceTurnSuffix(SimulationFeedback feedback) {
    return feedback.getChatMessageId() == null ? "" : ", turn #" + feedback.getChatMessageId();
  }

  private String limitGeneratedSummary(String value) {
    if (value.length() <= GENERATED_SUMMARY_MAX_LENGTH) {
      return value;
    }
    return value.substring(0, GENERATED_SUMMARY_MAX_LENGTH);
  }
}
