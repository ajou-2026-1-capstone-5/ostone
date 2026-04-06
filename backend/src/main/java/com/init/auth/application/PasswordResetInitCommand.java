package com.init.auth.application;

import java.util.Objects;

public record PasswordResetInitCommand(String email) {
  public PasswordResetInitCommand {
    Objects.requireNonNull(email, "email must not be null");
    if (email.isBlank()) {
      throw new IllegalArgumentException("email must not be blank");
    }
  }
}
