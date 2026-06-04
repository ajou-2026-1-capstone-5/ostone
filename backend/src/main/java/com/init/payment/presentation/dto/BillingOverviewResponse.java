package com.init.payment.presentation.dto;

import com.init.payment.application.BillingOverviewResult;
import java.util.List;

public record BillingOverviewResponse(
    SubscriptionResponse subscription,
    BillingKeyResponse billingKey,
    List<PaymentResponse> payments,
    List<QuotaUsageResponse> quotaUsages) {

  public static BillingOverviewResponse from(BillingOverviewResult result) {
    return new BillingOverviewResponse(
        result.subscription() != null ? SubscriptionResponse.from(result.subscription()) : null,
        result.billingKey() != null ? BillingKeyResponse.from(result.billingKey()) : null,
        result.payments().stream().map(PaymentResponse::from).toList(),
        result.quotaUsages().stream().map(QuotaUsageResponse::from).toList());
  }
}
