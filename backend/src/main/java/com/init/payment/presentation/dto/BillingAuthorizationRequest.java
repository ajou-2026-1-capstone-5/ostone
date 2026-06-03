package com.init.payment.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record BillingAuthorizationRequest(@NotBlank String authKey, String customerKey) {}
