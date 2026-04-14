package com.init.workspace.application;

import java.util.Objects;

public record CreateWorkspaceCommand(
    String workspaceKey, String name, String description, Long ownerUserId) {

  public CreateWorkspaceCommand {
    Objects.requireNonNull(workspaceKey, "workspaceKey must not be null");
    Objects.requireNonNull(name, "name must not be null");
    Objects.requireNonNull(ownerUserId, "ownerUserId must not be null");
  }
}
