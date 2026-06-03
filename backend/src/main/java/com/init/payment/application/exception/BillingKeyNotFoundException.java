package com.init.payment.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class BillingKeyNotFoundException extends NotFoundException {
  public BillingKeyNotFoundException(Long workspaceId) {
    super("BILLING_KEY_NOT_FOUND", "등록된 결제수단(billingKey)이 없습니다. workspaceId=" + workspaceId);
  }
}
