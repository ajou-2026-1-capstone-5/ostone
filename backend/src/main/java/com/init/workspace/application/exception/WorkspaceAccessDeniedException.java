package com.init.workspace.application.exception;

import com.init.shared.application.exception.UnauthorizedException;

public class WorkspaceAccessDeniedException extends UnauthorizedException {
  public WorkspaceAccessDeniedException(String message) {
    super("WORKSPACE_ACCESS_DENIED", message);
  }
}
