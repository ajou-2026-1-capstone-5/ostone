package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class DomainPackDraftRequestInvalidException extends BadRequestException {

  public DomainPackDraftRequestInvalidException(String message) {
    super("DOMAIN_PACK_DRAFT_INVALID_REQUEST", message);
  }

  public DomainPackDraftRequestInvalidException(String message, Throwable cause) {
    super("DOMAIN_PACK_DRAFT_INVALID_REQUEST", message);
    initCause(cause);
  }
}
