package com.init.payment.application;

public record QuotaUsageResult(String resource, long used, int limit, boolean warning) {

  public static QuotaUsageResult of(String resource, long used, int limit) {
    return new QuotaUsageResult(resource, used, limit, limit <= 0 || used >= limit);
  }
}
