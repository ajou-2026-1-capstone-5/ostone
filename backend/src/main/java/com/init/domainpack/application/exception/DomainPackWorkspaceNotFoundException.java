package com.init.domainpack.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class DomainPackWorkspaceNotFoundException extends NotFoundException {
  public DomainPackWorkspaceNotFoundException(String message) {
    super("DOMAIN_PACK_WORKSPACE_NOT_FOUND", message);
  }
}
