package com.init.payment.presentation.dto;

import com.init.payment.application.QuotaUsageResult;

public record QuotaUsageResponse(String resource, long used, int limit, boolean warning) {

  public static QuotaUsageResponse from(QuotaUsageResult result) {
    return new QuotaUsageResponse(
        result.resource(), result.used(), result.limit(), result.warning());
  }
}
