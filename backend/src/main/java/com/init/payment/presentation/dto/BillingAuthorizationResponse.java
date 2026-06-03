package com.init.payment.presentation.dto;

import com.init.payment.application.BillingAuthorizationResult;

public record BillingAuthorizationResponse(
    SubscriptionResponse subscription, BillingKeyResponse billingKey) {

  public static BillingAuthorizationResponse from(BillingAuthorizationResult result) {
    return new BillingAuthorizationResponse(
        SubscriptionResponse.from(result.subscription()),
        BillingKeyResponse.from(result.billingKey()));
  }
}
