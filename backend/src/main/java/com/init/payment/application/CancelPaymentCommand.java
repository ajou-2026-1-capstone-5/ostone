package com.init.payment.application;

public record CancelPaymentCommand(
    Long workspaceId, Long userId, String paymentKey, String cancelReason, Long cancelAmount) {}
