package com.init.payment.domain.model;

public enum SubscriptionStatus {
  INCOMPLETE,
  AUTHORIZING,
  ACTIVE,
  PAST_DUE,
  CANCELED;

  public boolean isActive() {
    return this == ACTIVE;
  }

  public boolean isTerminated() {
    return this == CANCELED;
  }
}
