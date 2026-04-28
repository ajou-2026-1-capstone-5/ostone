package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class WebhookReceiptTypeConflictException extends DuplicateException {

  public WebhookReceiptTypeConflictException(
      String externalEventId, String existingType, String requestedType) {
    super(
        "WEBHOOK_RECEIPT_TYPE_CONFLICT",
        "externalEventId가 다른 webhook type으로 이미 수신되었습니다. externalEventId="
            + externalEventId
            + ", existingType="
            + existingType
            + ", requestedType="
            + requestedType);
  }
}
