package com.init.auth.presentation.dto;

public record TokenRefreshResponse(String accessToken, String tokenType, long expiresIn) {}
