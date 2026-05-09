package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackDraftReasonTooLongException;

final class DomainPackDraftReasonValidator {

  private static final int MAX_REASON_LENGTH = 1000;

  private DomainPackDraftReasonValidator() {}

  static void validate(String reason) {
    if (reason != null && reason.length() > MAX_REASON_LENGTH) {
      throw new DomainPackDraftReasonTooLongException();
    }
  }
}
