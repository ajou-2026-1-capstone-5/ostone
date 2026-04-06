package com.init.auth.application;

public record PasswordResetCompleteCommand(String resetToken, String newPassword) {}
