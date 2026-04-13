package com.init.workspace.application;

import java.util.Objects;

public record UpdateWorkspaceCommand(
    Long workspaceId,
    Long userId,
    boolean nameProvided,
    String name,
    boolean descriptionProvided,
    String description) {

  public UpdateWorkspaceCommand {
    Objects.requireNonNull(workspaceId, "workspaceId must not be null");
    Objects.requireNonNull(userId, "userId must not be null");
  }
}
