package com.init.payment.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class SubscriptionNotFoundException extends NotFoundException {
  public SubscriptionNotFoundException(Long workspaceId) {
    super("SUBSCRIPTION_NOT_FOUND", "구독을 찾을 수 없습니다. workspaceId=" + workspaceId);
  }
}
