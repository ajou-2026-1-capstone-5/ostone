package com.init.payment.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record ConfirmPaymentRequest(
    @NotBlank String paymentKey, @NotBlank String orderId, @Positive long amount) {}
