package com.init.workspace.application;

import java.time.OffsetDateTime;

public record AdminCustomerBillingSummaryResult(
    String subscriptionStatus,
    String planName,
    OffsetDateTime currentPeriodEnd,
    OffsetDateTime updatedAt) {

  public static AdminCustomerBillingSummaryResult unavailable() {
    return new AdminCustomerBillingSummaryResult(null, null, null, null);
  }
}
