package com.init.domainpack.application.exception;

import com.init.shared.application.exception.UnauthorizedException;

public class DomainPackUnauthorizedWorkspaceAccessException extends UnauthorizedException {
  public DomainPackUnauthorizedWorkspaceAccessException(String message) {
    super("FORBIDDEN", message);
  }
}
