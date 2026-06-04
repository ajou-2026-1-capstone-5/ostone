package com.init.payment.application;

import java.util.List;

public record BillingOverviewResult(
    SubscriptionResult subscription,
    BillingKeySummary billingKey,
    List<PaymentResult> payments,
    List<QuotaUsageResult> quotaUsages) {

  public static BillingOverviewResult empty() {
    return new BillingOverviewResult(null, null, List.of(), List.of());
  }
}
