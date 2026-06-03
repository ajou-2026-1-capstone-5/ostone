package com.init.payment.domain.model;

/** 금액 Value Object. 음수 금액과 빈 통화를 거부한다. */
public record Money(long amount, String currency) {

  public static final String DEFAULT_CURRENCY = "KRW";

  public Money {
    if (amount < 0) {
      throw new IllegalArgumentException("amount must not be negative: " + amount);
    }
    if (currency == null || currency.isBlank()) {
      throw new IllegalArgumentException("currency must not be blank");
    }
  }

  public static Money of(long amount, String currency) {
    return new Money(amount, currency);
  }

  public static Money krw(long amount) {
    return new Money(amount, DEFAULT_CURRENCY);
  }

  public boolean isSameAmount(long other) {
    return this.amount == other;
  }
}
