package com.init.payment.domain.model;

import java.time.OffsetDateTime;

public enum BillingInterval {
  MONTH,
  YEAR;

  public OffsetDateTime advance(OffsetDateTime from) {
    return switch (this) {
      case MONTH -> from.plusMonths(1);
      case YEAR -> from.plusYears(1);
    };
  }
}
