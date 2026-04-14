package com.init.workspace.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkspaceInvalidKeyException extends BadRequestException {
  public WorkspaceInvalidKeyException(String message) {
    super("WORKSPACE_INVALID_KEY", message);
  }
}
