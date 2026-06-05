package com.init.workflowruntime.application;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.workflowruntime.application.matching.WorkflowMatchingProfileBuildRequestService;
import com.init.workflowruntime.domain.SimulationFeedback;
import com.init.workflowruntime.domain.SimulationFeedbackRepository;
import com.init.workflowruntime.domain.SimulationImprovementCandidate;
import com.init.workflowruntime.domain.SimulationImprovementCandidateRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SimulationImprovementCandidateDecisionService {

  private static final String PROFILE_TRIGGER_SIMULATION_CANDIDATE_APPLIED =
      "SIMULATION_CANDIDATE_APPLIED";

  private final SimulationImprovementCandidateRepository candidateRepository;
  private final SimulationFeedbackRepository feedbackRepository;
  private final SimulationImprovementCandidateReviewTaskService reviewTaskService;
  private final SimulationImprovementDraftPatchService draftPatchService;
  private final WorkflowMatchingProfileBuildRequestService profileBuildRequestService;
  private final Clock clock;

  public SimulationImprovementCandidateDecisionService(
      SimulationImprovementCandidateRepository candidateRepository,
      SimulationFeedbackRepository feedbackRepository,
      SimulationImprovementCandidateReviewTaskService reviewTaskService,
      SimulationImprovementDraftPatchService draftPatchService,
      WorkflowMatchingProfileBuildRequestService profileBuildRequestService,
      Clock clock) {
    this.candidateRepository = candidateRepository;
    this.feedbackRepository = feedbackRepository;
    this.reviewTaskService = reviewTaskService;
    this.draftPatchService = draftPatchService;
    this.profileBuildRequestService = profileBuildRequestService;
    this.clock = clock;
  }

  public SimulationImprovementCandidate approve(
      Long workspaceId,
      Long userId,
      String reason,
      SimulationImprovementCandidate candidate,
      SimulationFeedback feedback) {
    reviewTaskService.requireOpenReviewTask(candidate);
    DomainPackVersion draftVersion =
        draftPatchService.applyDraftPatch(workspaceId, userId, candidate);
    enqueueRequiredProfileBuild(draftVersion.getId());
    OffsetDateTime now = OffsetDateTime.now(clock);
    reviewTaskService.recordApproval(candidate, userId, reason, draftVersion.getId(), now);
    candidate.markApplied(draftVersion.getId(), userId, reason, now);
    feedback.markResolved();
    feedbackRepository.save(feedback);
    return candidateRepository.save(candidate);
  }

  public SimulationImprovementCandidate reject(
      Long userId,
      String reason,
      SimulationImprovementCandidate candidate,
      SimulationFeedback feedback) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    reviewTaskService.recordRejection(candidate, userId, reason, now);
    candidate.markRejected(userId, reason, now);
    feedback.markDismissed();
    feedbackRepository.save(feedback);
    return candidateRepository.save(candidate);
  }

  private void enqueueRequiredProfileBuild(Long draftVersionId) {
    profileBuildRequestService.enqueue(
        draftVersionId, PROFILE_TRIGGER_SIMULATION_CANDIDATE_APPLIED);
  }
}
