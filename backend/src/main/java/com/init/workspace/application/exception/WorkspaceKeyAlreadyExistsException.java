package com.init.workspace.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class WorkspaceKeyAlreadyExistsException extends DuplicateException {
  public WorkspaceKeyAlreadyExistsException(String message) {
    super("WORKSPACE_KEY_CONFLICT", message);
  }

  public WorkspaceKeyAlreadyExistsException(String message, Throwable cause) {
    super("WORKSPACE_KEY_CONFLICT", message);
    initCause(cause);
  }
}
