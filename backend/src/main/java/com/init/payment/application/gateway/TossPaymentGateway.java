package com.init.payment.application.gateway;

public interface TossPaymentGateway {
  TossCancelResult cancelPayment(String paymentKey, String reason, String idempotencyKey);
}
