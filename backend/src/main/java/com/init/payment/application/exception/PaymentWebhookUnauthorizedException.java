package com.init.payment.application.exception;

import com.init.shared.application.exception.UnauthorizedException;

/** Toss 웹훅 시크릿 헤더 불일치 (U-003). */
public class PaymentWebhookUnauthorizedException extends UnauthorizedException {
  public PaymentWebhookUnauthorizedException() {
    super("PAYMENT_WEBHOOK_UNAUTHORIZED", "유효하지 않은 Toss webhook secret입니다.");
  }
}
