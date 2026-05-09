package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class DomainPackDraftReasonTooLongException extends BadRequestException {

  public static final String CODE = "DOMAIN_PACK_DRAFT_REASON_TOO_LONG";

  public DomainPackDraftReasonTooLongException() {
    super(CODE, "reason은 1000자 이하여야 합니다.");
  }
}
