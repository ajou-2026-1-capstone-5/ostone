package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.review.domain.model.ReviewDecision;
import com.init.review.domain.model.ReviewSession;
import com.init.review.domain.model.ReviewTask;
import com.init.review.domain.repository.ReviewDecisionRepository;
import com.init.review.domain.repository.ReviewSessionRepository;
import com.init.review.domain.repository.ReviewTaskRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.domain.SimulationImprovementCandidate;
import com.init.workflowruntime.domain.SimulationImprovementCandidateStatus;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SimulationImprovementCandidateReviewTaskService {

  private static final String REVIEW_PRIORITY_NORMAL = "NORMAL";

  private final ReviewSessionRepository reviewSessionRepository;
  private final ReviewTaskRepository reviewTaskRepository;
  private final ReviewDecisionRepository reviewDecisionRepository;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public SimulationImprovementCandidateReviewTaskService(
      ReviewSessionRepository reviewSessionRepository,
      ReviewTaskRepository reviewTaskRepository,
      ReviewDecisionRepository reviewDecisionRepository,
      ObjectMapper objectMapper,
      Clock clock) {
    this.reviewSessionRepository = reviewSessionRepository;
    this.reviewTaskRepository = reviewTaskRepository;
    this.reviewDecisionRepository = reviewDecisionRepository;
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  @Transactional
  public ReviewTask ensureReviewTask(SimulationImprovementCandidate candidate, Long userId) {
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
                            "READY_FOR_REVIEW 상태의 시뮬레이션 개선 후보를 " + "승인 또는 반려합니다.",
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

  @Transactional
  public void recordApproval(
      SimulationImprovementCandidate candidate,
      Long userId,
      String reason,
      Long appliedDomainPackVersionId,
      OffsetDateTime decidedAt) {
    recordDecision(candidate, userId, reason, "APPROVED", appliedDomainPackVersionId, decidedAt);
  }

  @Transactional
  public void recordRejection(
      SimulationImprovementCandidate candidate,
      Long userId,
      String reason,
      OffsetDateTime decidedAt) {
    recordDecision(candidate, userId, reason, "REJECTED", null, decidedAt);
  }

  private void recordDecision(
      SimulationImprovementCandidate candidate,
      Long userId,
      String reason,
      String decision,
      Long appliedDomainPackVersionId,
      OffsetDateTime decidedAt) {
    ReviewTask task = requireOpenReviewTask(candidate);
    task.resolve(userId, decidedAt);
    reviewTaskRepository.save(task);
    reviewDecisionRepository.save(
        ReviewDecision.create(
            task.getReviewSessionId(),
            ReviewTask.TARGET_SIMULATION_IMPROVEMENT_CANDIDATE,
            candidate.getId(),
            decision,
            reason,
            userId,
            decisionPayload(candidate, appliedDomainPackVersionId),
            decidedAt));
  }

  public ReviewTask requireOpenReviewTask(SimulationImprovementCandidate candidate) {
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
}
