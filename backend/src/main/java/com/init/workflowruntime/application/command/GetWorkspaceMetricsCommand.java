package com.init.workflowruntime.application.command;

import java.util.Objects;

public record GetWorkspaceMetricsCommand(Long workspaceId, Long userId) {
  public GetWorkspaceMetricsCommand {
    Objects.requireNonNull(workspaceId, "workspaceId must not be null");
    Objects.requireNonNull(userId, "userId must not be null");
  }
}
