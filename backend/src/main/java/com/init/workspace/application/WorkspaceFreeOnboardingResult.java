package com.init.workspace.application;

import com.init.workspace.domain.model.Workspace;
import java.time.OffsetDateTime;

public record WorkspaceFreeOnboardingResult(
    Long workspaceId,
    String status,
    Long datasetId,
    Long pipelineJobId,
    OffsetDateTime startedAt,
    OffsetDateTime consumedAt) {

  public static WorkspaceFreeOnboardingResult from(Workspace workspace) {
    return new WorkspaceFreeOnboardingResult(
        workspace.getId(),
        workspace.getFreeOnboardingStatus().name(),
        workspace.getFreeOnboardingDatasetId(),
        workspace.getFreeOnboardingPipelineJobId(),
        workspace.getFreeOnboardingStartedAt(),
        workspace.getFreeOnboardingConsumedAt());
  }
}
