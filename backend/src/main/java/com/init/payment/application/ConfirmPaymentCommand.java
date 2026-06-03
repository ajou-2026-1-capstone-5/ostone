package com.init.payment.application;

public record ConfirmPaymentCommand(
    Long workspaceId, Long userId, String paymentKey, String orderId, long amount) {}
