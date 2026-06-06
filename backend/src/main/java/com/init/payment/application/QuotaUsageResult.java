package com.init.payment.application;

import java.time.OffsetDateTime;

public record QuotaUsageResult(
    String resource, long used, int limit, boolean warning, OffsetDateTime nextAvailableAt) {

  public static QuotaUsageResult of(String resource, long used, int limit) {
    return of(resource, used, limit, null);
  }

  public static QuotaUsageResult of(
      String resource, long used, int limit, OffsetDateTime nextAvailableAt) {
    boolean warning = limit >= 0 && used >= limit;
    return new QuotaUsageResult(resource, used, limit, warning, warning ? nextAvailableAt : null);
  }
}
