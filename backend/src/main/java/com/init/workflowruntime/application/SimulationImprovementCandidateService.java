package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.application.DomainPackDraftSourceType;
import com.init.domainpack.application.DomainPackVersionCloneCommand;
import com.init.domainpack.application.DomainPackVersionCloneResult;
import com.init.domainpack.application.DomainPackVersionCloneService;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.review.domain.model.ReviewDecision;
import com.init.review.domain.model.ReviewSession;
import com.init.review.domain.model.ReviewTask;
import com.init.review.domain.repository.ReviewDecisionRepository;
import com.init.review.domain.repository.ReviewSessionRepository;
import com.init.review.domain.repository.ReviewTaskRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.ApproveSimulationImprovementCandidateCommand;
import com.init.workflowruntime.application.command.CreateSimulationImprovementCandidateCommand;
import com.init.workflowruntime.application.command.RejectSimulationImprovementCandidateCommand;
import com.init.workflowruntime.application.command.UpdateSimulationImprovementCandidateStatusCommand;
import com.init.workflowruntime.application.dto.SimulationImprovementCandidatePageResponse;
import com.init.workflowruntime.application.dto.SimulationImprovementCandidateResponse;
import com.init.workflowruntime.application.matching.WorkflowMatchingProfileBuildRequestService;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
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
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SimulationImprovementCandidateService {

  private static final int DEFAULT_PAGE = 0;
  private static final int DEFAULT_PAGE_SIZE = 20;
  private static final int MAX_PAGE_SIZE = 100;
  private static final int GENERATED_SUMMARY_MAX_LENGTH = 2000;
  private static final String REVIEW_PRIORITY_NORMAL = "NORMAL";

  private final SimulationFeedbackRepository feedbackRepository;
  private final SimulationImprovementCandidateRepository candidateRepository;
  private final ChatSessionRepository chatSessionRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final DomainPackVersionRepository domainPackVersionRepository;
  private final DomainPackVersionCloneService domainPackVersionCloneService;
  private final IntentDefinitionRepository intentDefinitionRepository;
  private final SlotDefinitionRepository slotDefinitionRepository;
  private final PolicyDefinitionRepository policyDefinitionRepository;
  private final RiskDefinitionRepository riskDefinitionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final ReviewSessionRepository reviewSessionRepository;
  private final ReviewTaskRepository reviewTaskRepository;
  private final ReviewDecisionRepository reviewDecisionRepository;
  private final WorkflowMatchingProfileBuildRequestService profileBuildRequestService;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public SimulationImprovementCandidateService(
      SimulationFeedbackRepository feedbackRepository,
      SimulationImprovementCandidateRepository candidateRepository,
      ChatSessionRepository chatSessionRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      DomainPackVersionRepository domainPackVersionRepository,
      DomainPackVersionCloneService domainPackVersionCloneService,
      IntentDefinitionRepository intentDefinitionRepository,
      SlotDefinitionRepository slotDefinitionRepository,
      PolicyDefinitionRepository policyDefinitionRepository,
      RiskDefinitionRepository riskDefinitionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      ReviewSessionRepository reviewSessionRepository,
      ReviewTaskRepository reviewTaskRepository,
      ReviewDecisionRepository reviewDecisionRepository,
      WorkflowMatchingProfileBuildRequestService profileBuildRequestService,
      ObjectMapper objectMapper,
      Clock clock) {
    this.feedbackRepository = feedbackRepository;
    this.candidateRepository = candidateRepository;
    this.chatSessionRepository = chatSessionRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.domainPackVersionCloneService = domainPackVersionCloneService;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.slotDefinitionRepository = slotDefinitionRepository;
    this.policyDefinitionRepository = policyDefinitionRepository;
    this.riskDefinitionRepository = riskDefinitionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.reviewSessionRepository = reviewSessionRepository;
    this.reviewTaskRepository = reviewTaskRepository;
    this.reviewDecisionRepository = reviewDecisionRepository;
    this.profileBuildRequestService = profileBuildRequestService;
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  @Transactional
  public SimulationImprovementCandidateResponse createFromFeedback(
      CreateSimulationImprovementCandidateCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    SimulationFeedback feedback = findFeedbackForUpdate(command.feedbackId());
    validateFeedbackWorkspace(command.workspaceId(), feedback);

    return candidateRepository
        .findByFeedbackId(feedback.getId())
        .map(SimulationImprovementCandidateResponse::from)
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
    return SimulationImprovementCandidatePageResponse.from(candidatePage);
  }

  public SimulationImprovementCandidateResponse getCandidate(
      Long workspaceId, Long userId, Long candidateId) {
    validateWorkspaceMembership(workspaceId, userId);
    SimulationImprovementCandidate candidate = findCandidate(candidateId);
    validateCandidateWorkspace(workspaceId, candidate);
    return SimulationImprovementCandidateResponse.from(candidate);
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
    ReviewTask task = ensureReviewTask(candidate, command.userId());
    candidate.submitForReview(task.getReviewSessionId(), task.getId());
    return SimulationImprovementCandidateResponse.from(candidateRepository.save(candidate));
  }

  @Transactional
  public SimulationImprovementCandidateResponse approve(
      ApproveSimulationImprovementCandidateCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    SimulationImprovementCandidate candidate = findCandidate(command.candidateId());
    validateCandidateWorkspace(command.workspaceId(), candidate);
    SimulationFeedback feedback = findFeedbackForUpdate(candidate.getFeedbackId());
    validateFeedbackWorkspace(command.workspaceId(), feedback);
    ReviewTask task = requireReviewTask(candidate);
    DomainPackVersion draftVersion =
        applyDraftPatch(command.workspaceId(), command.userId(), candidate);
    OffsetDateTime now = OffsetDateTime.now(clock);
    task.resolve(command.userId(), now);
    reviewTaskRepository.save(task);
    reviewDecisionRepository.save(
        ReviewDecision.create(
            task.getReviewSessionId(),
            ReviewTask.TARGET_SIMULATION_IMPROVEMENT_CANDIDATE,
            candidate.getId(),
            "APPROVED",
            command.reason(),
            command.userId(),
            decisionPayload(candidate, draftVersion.getId()),
            now));
    candidate.markApplied(draftVersion.getId(), command.userId(), command.reason(), now);
    feedback.markResolved();
    feedbackRepository.save(feedback);
    profileBuildRequestService.enqueue(draftVersion.getId(), "SIMULATION_CANDIDATE_APPLIED");
    return SimulationImprovementCandidateResponse.from(candidateRepository.save(candidate));
  }

  @Transactional
  public SimulationImprovementCandidateResponse reject(
      RejectSimulationImprovementCandidateCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    SimulationImprovementCandidate candidate = findCandidate(command.candidateId());
    validateCandidateWorkspace(command.workspaceId(), candidate);
    SimulationFeedback feedback = findFeedbackForUpdate(candidate.getFeedbackId());
    validateFeedbackWorkspace(command.workspaceId(), feedback);
    ReviewTask task = requireReviewTask(candidate);
    OffsetDateTime now = OffsetDateTime.now(clock);
    task.resolve(command.userId(), now);
    reviewTaskRepository.save(task);
    reviewDecisionRepository.save(
        ReviewDecision.create(
            task.getReviewSessionId(),
            ReviewTask.TARGET_SIMULATION_IMPROVEMENT_CANDIDATE,
            candidate.getId(),
            "REJECTED",
            command.reason(),
            command.userId(),
            decisionPayload(candidate, null),
            now));
    candidate.markRejected(command.userId(), command.reason(), now);
    feedback.markDismissed();
    feedbackRepository.save(feedback);
    return SimulationImprovementCandidateResponse.from(candidateRepository.save(candidate));
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
    candidate.defineDraftPatch(buildDraftPatchJson(candidate));
    SimulationImprovementCandidate saved = candidateRepository.save(candidate);
    feedback.markCandidateCreated();
    feedbackRepository.save(feedback);
    return SimulationImprovementCandidateResponse.from(saved);
  }

  private ReviewTask ensureReviewTask(SimulationImprovementCandidate candidate, Long userId) {
    if (candidate.getReviewTaskId() != null) {
      return reviewTaskRepository
          .findById(candidate.getReviewTaskId())
          .orElseThrow(
              () ->
                  new NotFoundException(
                      "SIMULATION_REVIEW_TASK_NOT_FOUND",
                      "Simulation review task not found: " + candidate.getReviewTaskId()));
    }
    OffsetDateTime now = OffsetDateTime.now(clock);
    ReviewSession session =
        reviewSessionRepository
            .findFirstByWorkspaceIdAndDomainPackVersionIdAndReviewKindAndStatusOrderByOpenedAtDesc(
                candidate.getWorkspaceId(),
                candidate.getDomainPackVersionId(),
                ReviewSession.KIND_SIMULATION_IMPROVEMENT,
                ReviewSession.STATUS_OPEN)
            .orElseGet(
                () ->
                    reviewSessionRepository.save(
                        ReviewSession.createDomainPackReview(
                            candidate.getWorkspaceId(),
                            candidate.getDomainPackVersionId(),
                            ReviewSession.KIND_SIMULATION_IMPROVEMENT,
                            "시뮬레이션 개선 후보 검토",
                            "READY_FOR_REVIEW 상태의 시뮬레이션 개선 후보를 승인 또는 반려합니다.",
                            userId,
                            reviewSessionMeta(candidate),
                            now)));
    return reviewTaskRepository
        .findFirstByReviewSessionIdAndTargetTypeAndTargetIdOrderByIdDesc(
            session.getId(), ReviewTask.TARGET_SIMULATION_IMPROVEMENT_CANDIDATE, candidate.getId())
        .orElseGet(
            () ->
                reviewTaskRepository.save(
                    ReviewTask.create(
                        session.getId(),
                        ReviewTask.TARGET_SIMULATION_IMPROVEMENT_CANDIDATE,
                        candidate.getId(),
                        reviewTargetRef(candidate),
                        candidate.getAfterSummary(),
                        REVIEW_PRIORITY_NORMAL,
                        candidate.getDraftPatchJson(),
                        now)));
  }

  private ReviewTask requireReviewTask(SimulationImprovementCandidate candidate) {
    if (candidate.getStatus() != SimulationImprovementCandidateStatus.READY_FOR_REVIEW) {
      throw new BadRequestException(
          "SIMULATION_CANDIDATE_NOT_READY", "READY_FOR_REVIEW 후보만 승인 또는 반려할 수 있습니다.");
    }
    if (candidate.getReviewTaskId() == null) {
      throw new BadRequestException(
          "SIMULATION_REVIEW_TASK_REQUIRED", "후보에 연결된 review task가 없습니다.");
    }
    ReviewTask task =
        reviewTaskRepository
            .findById(candidate.getReviewTaskId())
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "SIMULATION_REVIEW_TASK_NOT_FOUND",
                        "Simulation review task not found: " + candidate.getReviewTaskId()));
    if (!ReviewTask.STATUS_OPEN.equals(task.getStatus())) {
      throw new BadRequestException("SIMULATION_REVIEW_TASK_RESOLVED", "이미 처리된 review task입니다.");
    }
    return task;
  }

  private DomainPackVersion applyDraftPatch(
      Long workspaceId, Long userId, SimulationImprovementCandidate candidate) {
    DomainPackVersion sourceVersion =
        domainPackVersionRepository
            .findByIdForUpdate(candidate.getDomainPackVersionId())
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "DOMAIN_PACK_VERSION_NOT_FOUND",
                        "Domain pack version not found: " + candidate.getDomainPackVersionId()));
    DomainPackVersion draftVersion =
        resolveDraftVersion(workspaceId, userId, sourceVersion, candidate);
    applyDescriptionPatch(candidate, draftVersion.getId());
    return draftVersion;
  }

  private DomainPackVersion resolveDraftVersion(
      Long workspaceId,
      Long userId,
      DomainPackVersion sourceVersion,
      SimulationImprovementCandidate candidate) {
    if (DomainPackVersion.STATUS_DRAFT.equals(sourceVersion.getLifecycleStatus())) {
      return sourceVersion;
    }
    DomainPackVersion draft =
        domainPackVersionRepository
            .findFirstByDomainPackIdAndLifecycleStatusOrderByVersionNoDesc(
                sourceVersion.getDomainPackId(), DomainPackVersion.STATUS_DRAFT)
            .orElseGet(
                () -> {
                  DomainPackVersionCloneResult result =
                      domainPackVersionCloneService.cloneVersion(
                          new DomainPackVersionCloneCommand(
                              workspaceId,
                              sourceVersion.getDomainPackId(),
                              sourceVersion,
                              userId,
                              DomainPackDraftSourceType.SIMULATION_REVIEW,
                              "simulation improvement candidate #" + candidate.getId()));
                  return domainPackVersionRepository
                      .findByIdForUpdate(result.draftVersionId())
                      .orElseThrow(
                          () ->
                              new NotFoundException(
                                  "DOMAIN_PACK_VERSION_NOT_FOUND",
                                  "Domain pack version not found: " + result.draftVersionId()));
                });
    if (!DomainPackVersion.STATUS_DRAFT.equals(draft.getLifecycleStatus())) {
      throw new BadRequestException("DOMAIN_PACK_VERSION_NOT_DRAFT", "DRAFT version에만 반영할 수 있습니다.");
    }
    return domainPackVersionRepository
        .findByIdForUpdate(draft.getId())
        .orElseThrow(
            () ->
                new NotFoundException(
                    "DOMAIN_PACK_VERSION_NOT_FOUND",
                    "Domain pack version not found: " + draft.getId()));
  }

  private void applyDescriptionPatch(
      SimulationImprovementCandidate candidate, Long draftVersionId) {
    switch (candidate.getTargetElementType()) {
      case INTENT -> applyIntentPatch(candidate, draftVersionId);
      case SLOT -> applySlotPatch(candidate, draftVersionId);
      case POLICY -> applyPolicyPatch(candidate, draftVersionId);
      case RISK_RULE -> applyRiskPatch(candidate, draftVersionId);
      case WORKFLOW, HANDOFF, RESPONSE -> applyWorkflowPatch(candidate, draftVersionId);
      case UNKNOWN -> throw unsupportedTarget(candidate);
    }
  }

  private void applyIntentPatch(SimulationImprovementCandidate candidate, Long draftVersionId) {
    IntentDefinition intent =
        resolveIntent(candidate, draftVersionId).orElseThrow(() -> targetNotFound(candidate));
    intent.reviseDefinition(
        intent.getName(),
        candidate.getAfterSummary(),
        intent.getTaxonomyLevel(),
        intent.getEntryConditionJson(),
        intent.getMetaJson());
    intentDefinitionRepository.save(intent);
  }

  private void applySlotPatch(SimulationImprovementCandidate candidate, Long draftVersionId) {
    SlotDefinition slot =
        resolveSlot(candidate, draftVersionId).orElseThrow(() -> targetNotFound(candidate));
    slot.updateFields(
        slot.getName(),
        candidate.getAfterSummary(),
        slot.getIsSensitive(),
        slot.getValidationRuleJson(),
        slot.getDefaultValueJson(),
        slot.getMetaJson());
    slotDefinitionRepository.save(slot);
  }

  private void applyPolicyPatch(SimulationImprovementCandidate candidate, Long draftVersionId) {
    PolicyDefinition policy =
        resolvePolicy(candidate, draftVersionId).orElseThrow(() -> targetNotFound(candidate));
    policy.updateFields(
        policy.getName(),
        candidate.getAfterSummary(),
        policy.getSeverity(),
        policy.getConditionJson(),
        policy.getActionJson(),
        policy.getEvidenceJson(),
        policy.getMetaJson());
    policyDefinitionRepository.save(policy);
  }

  private void applyRiskPatch(SimulationImprovementCandidate candidate, Long draftVersionId) {
    RiskDefinition risk =
        resolveRisk(candidate, draftVersionId).orElseThrow(() -> targetNotFound(candidate));
    risk.updateFields(
        risk.getName(),
        candidate.getAfterSummary(),
        risk.getRiskLevel(),
        risk.getTriggerConditionJson(),
        risk.getHandlingActionJson(),
        risk.getEvidenceJson(),
        risk.getMetaJson());
    riskDefinitionRepository.save(risk);
  }

  private void applyWorkflowPatch(SimulationImprovementCandidate candidate, Long draftVersionId) {
    WorkflowDefinition workflow =
        resolveWorkflow(candidate, draftVersionId).orElseThrow(() -> targetNotFound(candidate));
    workflow.updateGraph(
        workflow.getName(),
        candidate.getAfterSummary(),
        workflow.getGraphJson(),
        workflow.getInitialState(),
        workflow.getTerminalStatesJson());
    workflowDefinitionRepository.save(workflow);
  }

  private Optional<IntentDefinition> resolveIntent(
      SimulationImprovementCandidate candidate, Long draftVersionId) {
    String key = candidate.getTargetElementKey();
    if (key == null && candidate.getTargetElementId() != null) {
      key =
          intentDefinitionRepository
              .findByIdAndDomainPackVersionId(
                  candidate.getTargetElementId(), candidate.getDomainPackVersionId())
              .map(IntentDefinition::getIntentCode)
              .orElse(null);
    }
    if (key != null) {
      return intentDefinitionRepository.findByDomainPackVersionIdAndIntentCode(draftVersionId, key);
    }
    return candidate.getTargetElementId() == null
        ? Optional.empty()
        : intentDefinitionRepository.findByIdAndDomainPackVersionId(
            candidate.getTargetElementId(), draftVersionId);
  }

  private Optional<SlotDefinition> resolveSlot(
      SimulationImprovementCandidate candidate, Long draftVersionId) {
    String key = candidate.getTargetElementKey();
    if (key == null && candidate.getTargetElementId() != null) {
      key =
          slotDefinitionRepository
              .findByIdAndDomainPackVersionId(
                  candidate.getTargetElementId(), candidate.getDomainPackVersionId())
              .map(SlotDefinition::getSlotCode)
              .orElse(null);
    }
    if (key != null) {
      return slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(draftVersionId, key);
    }
    return candidate.getTargetElementId() == null
        ? Optional.empty()
        : slotDefinitionRepository.findByIdAndDomainPackVersionId(
            candidate.getTargetElementId(), draftVersionId);
  }

  private Optional<PolicyDefinition> resolvePolicy(
      SimulationImprovementCandidate candidate, Long draftVersionId) {
    String key = candidate.getTargetElementKey();
    if (key == null && candidate.getTargetElementId() != null) {
      key =
          policyDefinitionRepository
              .findByIdAndDomainPackVersionId(
                  candidate.getTargetElementId(), candidate.getDomainPackVersionId())
              .map(PolicyDefinition::getPolicyCode)
              .orElse(null);
    }
    if (key != null) {
      return policyDefinitionRepository.findByDomainPackVersionIdAndPolicyCode(draftVersionId, key);
    }
    return candidate.getTargetElementId() == null
        ? Optional.empty()
        : policyDefinitionRepository.findByIdAndDomainPackVersionId(
            candidate.getTargetElementId(), draftVersionId);
  }

  private Optional<RiskDefinition> resolveRisk(
      SimulationImprovementCandidate candidate, Long draftVersionId) {
    String key = candidate.getTargetElementKey();
    if (key == null && candidate.getTargetElementId() != null) {
      key =
          riskDefinitionRepository
              .findByIdAndDomainPackVersionId(
                  candidate.getTargetElementId(), candidate.getDomainPackVersionId())
              .map(RiskDefinition::getRiskCode)
              .orElse(null);
    }
    if (key != null) {
      return riskDefinitionRepository.findByDomainPackVersionIdAndRiskCode(draftVersionId, key);
    }
    return candidate.getTargetElementId() == null
        ? Optional.empty()
        : riskDefinitionRepository.findByIdAndDomainPackVersionId(
            candidate.getTargetElementId(), draftVersionId);
  }

  private Optional<WorkflowDefinition> resolveWorkflow(
      SimulationImprovementCandidate candidate, Long draftVersionId) {
    String key = candidate.getTargetElementKey();
    if (key == null && candidate.getTargetElementId() != null) {
      key =
          workflowDefinitionRepository
              .findByIdAndDomainPackVersionId(
                  candidate.getTargetElementId(), candidate.getDomainPackVersionId())
              .map(WorkflowDefinition::getWorkflowCode)
              .orElse(null);
    }
    if (key != null) {
      return workflowDefinitionRepository.findByDomainPackVersionIdAndWorkflowCode(
          draftVersionId, key);
    }
    return candidate.getTargetElementId() == null
        ? Optional.empty()
        : workflowDefinitionRepository.findByIdAndDomainPackVersionId(
            candidate.getTargetElementId(), draftVersionId);
  }

  private BadRequestException targetNotFound(SimulationImprovementCandidate candidate) {
    return new BadRequestException(
        "SIMULATION_CANDIDATE_TARGET_NOT_FOUND",
        "개선 후보를 반영할 draft 대상 요소를 찾을 수 없습니다: " + candidate.getId());
  }

  private BadRequestException unsupportedTarget(SimulationImprovementCandidate candidate) {
    return new BadRequestException(
        "SIMULATION_CANDIDATE_TARGET_UNSUPPORTED",
        "변경 대상 요소를 명시해야 승인할 수 있습니다: " + candidate.getId());
  }

  private String buildDraftPatchJson(SimulationImprovementCandidate candidate) {
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
    return toJson(root);
  }

  private String reviewSessionMeta(SimulationImprovementCandidate candidate) {
    ObjectNode root = objectMapper.createObjectNode();
    root.put("schemaVersion", "simulation-improvement-review-session.v1");
    root.put("source", "simulation");
    root.put("domainPackVersionId", candidate.getDomainPackVersionId());
    return toJson(root);
  }

  private String reviewTargetRef(SimulationImprovementCandidate candidate) {
    ObjectNode root = objectMapper.createObjectNode();
    root.put("schemaVersion", "simulation-improvement-review-task.v1");
    root.put("candidateId", candidate.getId());
    root.put("feedbackId", candidate.getFeedbackId());
    root.put("simulationSessionId", candidate.getChatSessionId());
    if (candidate.getChatMessageId() != null) {
      root.put("simulationTurnId", candidate.getChatMessageId());
    }
    root.put("candidateType", candidate.getCandidateType().name());
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
    return toJson(root);
  }

  private String decisionPayload(
      SimulationImprovementCandidate candidate, Long appliedDomainPackVersionId) {
    ObjectNode root = objectMapper.createObjectNode();
    root.put("schemaVersion", "simulation-improvement-review-decision.v1");
    root.put("candidateId", candidate.getId());
    root.put("feedbackId", candidate.getFeedbackId());
    if (appliedDomainPackVersionId != null) {
      root.put("appliedDomainPackVersionId", appliedDomainPackVersionId);
    }
    root.set("draftPatch", readObject(candidate.getDraftPatchJson()));
    return toJson(root);
  }

  private ObjectNode readObject(String json) {
    try {
      if (json == null || json.isBlank() || !objectMapper.readTree(json).isObject()) {
        return objectMapper.createObjectNode();
      }
      return (ObjectNode) objectMapper.readTree(json);
    } catch (JsonProcessingException e) {
      return objectMapper.createObjectNode();
    }
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
