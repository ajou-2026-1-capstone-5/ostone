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
    OffsetDateTime updatedAt) {

  public static WorkspaceResult from(Workspace workspace, WorkspaceMember member) {
    return new WorkspaceResult(
        workspace.getId(),
        workspace.getWorkspaceKey().getValue(),
        workspace.getName(),
        workspace.getDescription(),
        workspace.getStatus().name(),
        member.getMemberRole().name(),
        workspace.getCreatedAt(),
        workspace.getUpdatedAt());
  }
}
