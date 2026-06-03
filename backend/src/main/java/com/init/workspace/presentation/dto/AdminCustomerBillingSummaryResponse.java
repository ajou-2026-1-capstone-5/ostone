package com.init.workspace.presentation.dto;

import com.init.workspace.application.AdminCustomerBillingSummaryResult;
import java.time.OffsetDateTime;

public record AdminCustomerBillingSummaryResponse(
    String subscriptionStatus,
    String planName,
    OffsetDateTime currentPeriodEnd,
    OffsetDateTime updatedAt) {

  static AdminCustomerBillingSummaryResponse from(AdminCustomerBillingSummaryResult result) {
    if (result == null) {
      return new AdminCustomerBillingSummaryResponse(null, null, null, null);
    }
    return new AdminCustomerBillingSummaryResponse(
        result.subscriptionStatus(),
        result.planName(),
        result.currentPeriodEnd(),
        result.updatedAt());
  }
}
