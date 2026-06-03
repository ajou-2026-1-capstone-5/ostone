package com.init.payment.application;

public record HandleTossWebhookCommand(
    String secretHeader,
    String transmissionId,
    String eventType,
    String paymentKey,
    String maskedPayload) {

  /** 웹훅 멱등 키. lastTransactionKey → eventId → paymentKey:status 우선순위 (U-003). */
  public static String resolveTransmissionId(
      String lastTransactionKey,
      String eventId,
      String paymentKey,
      String status,
      String eventType) {
    if (lastTransactionKey != null && !lastTransactionKey.isBlank()) {
      return lastTransactionKey;
    }
    if (eventId != null && !eventId.isBlank()) {
      return eventId;
    }
    String base = (paymentKey != null && !paymentKey.isBlank()) ? paymentKey : eventType;
    if (base == null || base.isBlank() || status == null || status.isBlank()) {
      throw new IllegalArgumentException(
          "Unable to resolve webhook transmissionId: paymentKey="
              + paymentKey
              + ", status="
              + status);
    }
    return base + ":" + status;
  }
}
