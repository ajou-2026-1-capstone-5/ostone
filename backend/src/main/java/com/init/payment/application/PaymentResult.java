package com.init.payment.application;

import com.init.payment.domain.model.Payment;
import java.time.OffsetDateTime;

public record PaymentResult(
    Long id,
    String orderId,
    String paymentKey,
    long amount,
    String currency,
    String status,
    String method,
    OffsetDateTime approvedAt,
    String receiptUrl,
    OffsetDateTime createdAt) {

  public static PaymentResult from(Payment payment) {
    return new PaymentResult(
        payment.getId(),
        payment.getOrderId(),
        payment.getPaymentKey(),
        payment.getAmount(),
        payment.getCurrency(),
        payment.getStatus().name(),
        payment.getMethod(),
        payment.getApprovedAt(),
        payment.getReceiptUrl(),
        payment.getCreatedAt());
  }
}
