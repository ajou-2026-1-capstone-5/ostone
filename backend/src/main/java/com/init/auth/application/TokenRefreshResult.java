package com.init.auth.application;

public record TokenRefreshResult(
    String accessToken, String refreshToken, String tokenType, long expiresIn) {}
