package com.init.workspace.presentation.dto;

import com.init.workspace.application.WorkspaceResult;
import java.time.OffsetDateTime;

public record WorkspaceResponse(
    Long id,
    String workspaceKey,
    String name,
    String description,
    String status,
    String myRole,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static WorkspaceResponse from(WorkspaceResult result) {
    return new WorkspaceResponse(
        result.workspaceId(),
        result.workspaceKey(),
        result.name(),
        result.description(),
        result.status(),
        result.myRole(),
        result.createdAt(),
        result.updatedAt());
  }
}
