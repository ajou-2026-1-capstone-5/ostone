package com.init.payment.application.port;

import java.time.OffsetDateTime;

/** Toss 결제 승인/취소/조회 결과. {@code maskedRawJson}은 민감정보가 제거된 응답이다 (U-012). */
public record TossPaymentResult(
    String paymentKey,
    String orderId,
    long totalAmount,
    String status,
    String method,
    OffsetDateTime approvedAt,
    String receiptUrl,
    String transactionKey,
    String maskedRawJson) {

  public boolean isDone() {
    return "DONE".equals(status);
  }

  public boolean isCanceled() {
    return "CANCELED".equals(status);
  }

  public boolean isPartialCanceled() {
    return "PARTIAL_CANCELED".equals(status);
  }
}
