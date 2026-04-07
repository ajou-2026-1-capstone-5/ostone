package com.init.auth.application;

public record PasswordResetInitResult(boolean accepted, String rawToken) {}
