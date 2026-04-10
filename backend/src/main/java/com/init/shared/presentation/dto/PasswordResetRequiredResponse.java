package com.init.shared.presentation.dto;

public record PasswordResetRequiredResponse(String code, String message, String resetToken) {}
