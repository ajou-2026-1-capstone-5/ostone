package com.init.workspace.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkspaceInvalidNameException extends BadRequestException {
  public WorkspaceInvalidNameException(String message) {
    super("WORKSPACE_INVALID_NAME", message);
  }
}
