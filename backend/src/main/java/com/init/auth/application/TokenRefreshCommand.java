package com.init.auth.application;

import java.util.Objects;

public record TokenRefreshCommand(String refreshToken) {
  public TokenRefreshCommand {
    Objects.requireNonNull(refreshToken, "refreshToken must not be null");
    if (refreshToken.isBlank()) {
      throw new IllegalArgumentException("refreshToken must not be blank");
    }
  }
}
