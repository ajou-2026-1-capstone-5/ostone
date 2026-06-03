package com.init.payment.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateSubscriptionRequest(@NotBlank String planKey) {}
