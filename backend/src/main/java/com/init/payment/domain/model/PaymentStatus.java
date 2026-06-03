package com.init.payment.domain.model;

/** Toss v2 결제 status와 1:1 매핑 (U-009). */
public enum PaymentStatus {
  READY,
  IN_PROGRESS,
  DONE,
  CANCELED,
  PARTIAL_CANCELED,
  ABORTED,
  EXPIRED;

  public boolean isDone() {
    return this == DONE;
  }

  public boolean isCanceled() {
    return this == CANCELED || this == PARTIAL_CANCELED;
  }
}
