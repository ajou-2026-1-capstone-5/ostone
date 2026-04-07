package com.init.auth.presentation.dto;

public record TokenRefreshResponse(
    String accessToken, String refreshToken, String tokenType, long expiresIn) {}
