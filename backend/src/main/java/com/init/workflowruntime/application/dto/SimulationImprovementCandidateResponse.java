package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.SimulationImprovementCandidate;
import com.init.workflowruntime.domain.SimulationImprovementCandidateStatus;
import com.init.workflowruntime.domain.SimulationImprovementCandidateTargetType;
import com.init.workflowruntime.domain.SimulationImprovementCandidateType;
import java.time.OffsetDateTime;

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
    SimulationImprovementCandidateStatus status,
    Long createdBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static SimulationImprovementCandidateResponse from(
      SimulationImprovementCandidate candidate) {
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
        candidate.getStatus(),
        candidate.getCreatedBy(),
        candidate.getCreatedAt(),
        candidate.getUpdatedAt());
  }
}
