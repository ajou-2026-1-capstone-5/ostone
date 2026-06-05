package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.SimulationGoldenCase;
import java.time.OffsetDateTime;

public record SimulationGoldenCaseResponse(
    Long id,
    Long workspaceId,
    Long sourceSessionId,
    Long sourceDomainPackVersionId,
    String name,
    String inputMessagesJson,
    String expectedJson,
    Long createdBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    SimulationGoldenCaseReplayResultResponse latestReplayResult) {

  public static SimulationGoldenCaseResponse from(
      SimulationGoldenCase goldenCase,
      SimulationGoldenCaseReplayResultResponse latestReplayResult) {
    return new SimulationGoldenCaseResponse(
        goldenCase.getId(),
        goldenCase.getWorkspaceId(),
        goldenCase.getSourceChatSessionId(),
        goldenCase.getSourceDomainPackVersionId(),
        goldenCase.getName(),
        goldenCase.getInputMessagesJson(),
        goldenCase.getExpectedJson(),
        goldenCase.getCreatedBy(),
        goldenCase.getCreatedAt(),
        goldenCase.getUpdatedAt(),
        latestReplayResult);
  }
}
