package com.init.workspace.application;

import com.init.workspace.domain.model.Workspace;
import com.init.workspace.domain.model.WorkspaceMember;
import java.time.OffsetDateTime;

public record WorkspaceResult(
    Long workspaceId,
    String workspaceKey,
    String name,
    String description,
    String status,
    String myRole,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    String freeOnboardingStatus,
    Long freeOnboardingDatasetId,
    Long freeOnboardingPipelineJobId,
    OffsetDateTime freeOnboardingStartedAt,
    OffsetDateTime freeOnboardingConsumedAt) {

  public WorkspaceResult(
      Long workspaceId,
      String workspaceKey,
      String name,
      String description,
      String status,
      String myRole,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt) {
    this(
        workspaceId,
        workspaceKey,
        name,
        description,
        status,
        myRole,
        createdAt,
        updatedAt,
        "AVAILABLE",
        null,
        null,
        null,
        null);
  }

  public static WorkspaceResult from(Workspace workspace, WorkspaceMember member) {
    return new WorkspaceResult(
        workspace.getId(),
        workspace.getWorkspaceKey().getValue(),
        workspace.getName(),
        workspace.getDescription(),
        workspace.getStatus().name(),
        member.getMemberRole().name(),
        workspace.getCreatedAt(),
        workspace.getUpdatedAt(),
        workspace.getFreeOnboardingStatus().name(),
        workspace.getFreeOnboardingDatasetId(),
        workspace.getFreeOnboardingPipelineJobId(),
        workspace.getFreeOnboardingStartedAt(),
        workspace.getFreeOnboardingConsumedAt());
  }
}
