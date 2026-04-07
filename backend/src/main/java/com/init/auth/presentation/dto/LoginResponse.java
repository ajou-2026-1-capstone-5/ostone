package com.init.auth.presentation.dto;

public record LoginResponse(
    String accessToken, String refreshToken, String tokenType, long expiresIn, UserInfo user) {

  public record UserInfo(long id, String email, String name, String role) {}
}
