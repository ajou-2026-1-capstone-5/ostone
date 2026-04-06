package com.init.auth.application;

import java.util.Objects;

public record PasswordResetCompleteCommand(String resetToken, String newPassword) {
  public PasswordResetCompleteCommand {
    Objects.requireNonNull(resetToken, "resetToken must not be null");
    if (resetToken.isBlank()) {
      throw new IllegalArgumentException("resetToken must not be blank");
    }
    Objects.requireNonNull(newPassword, "newPassword must not be null");
    if (newPassword.isBlank()) {
      throw new IllegalArgumentException("newPassword must not be blank");
    }
  }
}
