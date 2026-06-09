package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.application.SimulationCandidatePatchViewMapper.PatchView;
import com.init.workflowruntime.domain.SimulationImprovementCandidate;
import com.init.workflowruntime.domain.SimulationImprovementCandidateStatus;
import com.init.workflowruntime.domain.SimulationImprovementCandidateTargetType;
import com.init.workflowruntime.domain.SimulationImprovementCandidateType;
import com.init.workflowruntime.domain.SimulationPatchValidationStatus;
import java.time.OffsetDateTime;
import java.util.List;

public record SimulationImprovementCandidateResponse(
    Long id,
    Long workspaceId,
    Long domainPackVersionId,
    Long feedbackId,
    Long sessionId,
    Long chatMessageId,
    SimulationImprovementCandidateType candidateType,
    SimulationImprovementCandidateTargetType targetElementType,
    Long targetElementId,
    String targetElementKey,
    String beforeSummary,
    String afterSummary,
    String evidenceSummary,
    Long reviewSessionId,
    Long reviewTaskId,
    Long appliedDomainPackVersionId,
    String draftPatchJson,
    String decisionReason,
    Long decidedBy,
    OffsetDateTime decidedAt,
    SimulationImprovementCandidateStatus status,
    Long createdBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    String patchSchemaVersion,
    String patchSummary,
    SimulationPatchValidationStatus patchValidationStatus,
    List<String> patchValidationErrors,
    List<NormalizedPatchOperationView> operations) {

  public static SimulationImprovementCandidateResponse from(
      SimulationImprovementCandidate candidate, PatchView patchView) {
    return new SimulationImprovementCandidateResponse(
        candidate.getId(),
        candidate.getWorkspaceId(),
        candidate.getDomainPackVersionId(),
        candidate.getFeedbackId(),
        candidate.getChatSessionId(),
        candidate.getChatMessageId(),
        candidate.getCandidateType(),
        candidate.getTargetElementType(),
        candidate.getTargetElementId(),
        candidate.getTargetElementKey(),
        candidate.getBeforeSummary(),
        candidate.getAfterSummary(),
        candidate.getEvidenceSummary(),
        candidate.getReviewSessionId(),
        candidate.getReviewTaskId(),
        candidate.getAppliedDomainPackVersionId(),
        candidate.getDraftPatchJson(),
        candidate.getDecisionReason(),
        candidate.getDecidedBy(),
        candidate.getDecidedAt(),
        candidate.getStatus(),
        candidate.getCreatedBy(),
        candidate.getCreatedAt(),
        candidate.getUpdatedAt(),
        patchView.schemaVersion(),
        patchView.summary(),
        patchView.validationStatus(),
        patchView.errors(),
        patchView.operations());
  }
}
