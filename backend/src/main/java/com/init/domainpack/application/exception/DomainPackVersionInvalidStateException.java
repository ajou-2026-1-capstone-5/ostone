package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class DomainPackVersionInvalidStateException extends BadRequestException {
  public DomainPackVersionInvalidStateException(String message) {
    super("DOMAIN_PACK_INVALID_STATE", message);
  }
}
