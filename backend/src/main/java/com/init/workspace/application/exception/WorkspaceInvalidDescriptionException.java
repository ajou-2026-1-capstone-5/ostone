package com.init.workspace.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkspaceInvalidDescriptionException extends BadRequestException {
  public WorkspaceInvalidDescriptionException(String message) {
    super("WORKSPACE_INVALID_DESCRIPTION", message);
  }
}
