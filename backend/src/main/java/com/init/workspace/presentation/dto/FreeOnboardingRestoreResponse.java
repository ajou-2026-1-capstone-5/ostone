package com.init.workspace.presentation.dto;

import com.init.workspace.application.WorkspaceFreeOnboardingResult;
import java.time.OffsetDateTime;

public record FreeOnboardingRestoreResponse(
    Long workspaceId,
    String status,
    Long datasetId,
    Long pipelineJobId,
    OffsetDateTime startedAt,
    OffsetDateTime consumedAt) {

  public static FreeOnboardingRestoreResponse from(WorkspaceFreeOnboardingResult result) {
    return new FreeOnboardingRestoreResponse(
        result.workspaceId(),
        result.status(),
        result.datasetId(),
        result.pipelineJobId(),
        result.startedAt(),
        result.consumedAt());
  }
}
