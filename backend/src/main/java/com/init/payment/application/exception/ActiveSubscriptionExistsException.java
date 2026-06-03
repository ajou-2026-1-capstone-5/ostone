package com.init.payment.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class ActiveSubscriptionExistsException extends DuplicateException {
  public ActiveSubscriptionExistsException(Long workspaceId) {
    super("SUBSCRIPTION_ALREADY_EXISTS", "이미 진행 중인 구독이 있습니다. workspaceId=" + workspaceId);
  }
}
