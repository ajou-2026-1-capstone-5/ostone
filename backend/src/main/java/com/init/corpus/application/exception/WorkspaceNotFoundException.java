package com.init.corpus.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class WorkspaceNotFoundException extends NotFoundException {
  public WorkspaceNotFoundException(String message) {
    super("WORKSPACE_NOT_FOUND", message);
  }
}
