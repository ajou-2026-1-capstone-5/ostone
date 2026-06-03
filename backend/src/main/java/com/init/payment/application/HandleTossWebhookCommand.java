package com.init.payment.application;

public record HandleTossWebhookCommand(
    String secretHeader,
    String transmissionId,
    String eventType,
    String paymentKey,
    String maskedPayload) {}
