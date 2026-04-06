package com.init.auth.application;

import java.util.Objects;

public record LogoutCommand(String refreshToken) {
  public LogoutCommand {
    Objects.requireNonNull(refreshToken, "refreshToken must not be null");
    if (refreshToken.isBlank()) {
      throw new IllegalArgumentException("refreshToken must not be blank");
    }
  }
}
