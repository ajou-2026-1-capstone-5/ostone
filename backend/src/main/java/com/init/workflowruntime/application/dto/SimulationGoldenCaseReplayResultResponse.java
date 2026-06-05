package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.SimulationGoldenCaseReplayResult;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayStatus;
import java.time.OffsetDateTime;

public record SimulationGoldenCaseReplayResultResponse(
    Long id,
    Long workspaceId,
    Long goldenCaseId,
    Long domainPackVersionId,
    Long replaySessionId,
    SimulationGoldenCaseReplayStatus status,
    String expectedJson,
    String actualJson,
    String failureSummary,
    Long createdBy,
    OffsetDateTime createdAt) {

  public static SimulationGoldenCaseReplayResultResponse from(
      SimulationGoldenCaseReplayResult replayResult) {
    if (replayResult == null) {
      return null;
    }
    return new SimulationGoldenCaseReplayResultResponse(
        replayResult.getId(),
        replayResult.getWorkspaceId(),
        replayResult.getGoldenCaseId(),
        replayResult.getDomainPackVersionId(),
        replayResult.getReplayChatSessionId(),
        replayResult.getStatus(),
        replayResult.getExpectedJson(),
        replayResult.getActualJson(),
        replayResult.getFailureSummary(),
        replayResult.getCreatedBy(),
        replayResult.getCreatedAt());
  }
}
