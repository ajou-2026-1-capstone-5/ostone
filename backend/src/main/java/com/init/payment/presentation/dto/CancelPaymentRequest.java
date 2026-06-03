package com.init.payment.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/** cancelAmount가 null이면 전액 취소. */
public record CancelPaymentRequest(@NotBlank String cancelReason, @Positive Long cancelAmount) {}
