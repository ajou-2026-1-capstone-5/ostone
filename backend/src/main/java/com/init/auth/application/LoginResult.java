package com.init.auth.application;

public record LoginResult(
    String accessToken,
    String refreshToken,
    String tokenType,
    long expiresIn,
    long userId,
    String email,
    String name,
    String role) {}
