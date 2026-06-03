package com.init.payment.presentation.dto;

import com.init.payment.application.PaymentResult;
import java.time.OffsetDateTime;

public record PaymentResponse(
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

  public static PaymentResponse from(PaymentResult result) {
    return new PaymentResponse(
        result.id(),
        result.orderId(),
        result.paymentKey(),
        result.amount(),
        result.currency(),
        result.status(),
        result.method(),
        result.approvedAt(),
        result.receiptUrl(),
        result.createdAt());
  }
}
