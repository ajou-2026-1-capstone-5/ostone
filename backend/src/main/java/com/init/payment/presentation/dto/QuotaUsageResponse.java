package com.init.payment.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.init.payment.application.QuotaUsageResult;
import java.time.OffsetDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record QuotaUsageResponse(
    String resource, long used, int limit, boolean warning, OffsetDateTime nextAvailableAt) {

  public static QuotaUsageResponse from(QuotaUsageResult result) {
    return new QuotaUsageResponse(
        result.resource(),
        result.used(),
        result.limit(),
        result.warning(),
        result.nextAvailableAt());
  }
}
