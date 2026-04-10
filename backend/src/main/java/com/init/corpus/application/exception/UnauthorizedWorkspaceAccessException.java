package com.init.corpus.application.exception;

import com.init.shared.application.exception.UnauthorizedException;

public class UnauthorizedWorkspaceAccessException extends UnauthorizedException {
  public UnauthorizedWorkspaceAccessException(String message) {
    super("FORBIDDEN", message);
  }
}
