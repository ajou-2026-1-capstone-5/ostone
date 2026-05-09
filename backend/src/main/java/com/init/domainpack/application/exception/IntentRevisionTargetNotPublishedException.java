package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class IntentRevisionTargetNotPublishedException extends BadRequestException {

  public IntentRevisionTargetNotPublishedException(Long intentId) {
    super(
        "INTENT_REVISION_TARGET_NOT_PUBLISHED",
        "PUBLISHED 상태의 Intent만 수정할 수 있습니다. intentId=" + intentId);
  }
}
