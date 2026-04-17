package com.init.domainpack.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class IntentDefinitionNotFoundException extends NotFoundException {
  public IntentDefinitionNotFoundException(Long intentId, Long versionId) {
    super(
        "INTENT_DEFINITION_NOT_FOUND",
        "Intent를 찾을 수 없습니다. intentId=" + intentId + ", versionId=" + versionId);
  }
}
