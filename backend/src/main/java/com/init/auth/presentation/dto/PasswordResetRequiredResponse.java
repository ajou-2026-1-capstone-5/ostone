package com.init.auth.presentation.dto;

public record PasswordResetRequiredResponse(String code, String message, String resetToken) {}
