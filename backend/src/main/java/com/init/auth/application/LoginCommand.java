package com.init.auth.application;

import java.util.Objects;

public record LoginCommand(String email, String password) {
  public LoginCommand {
    Objects.requireNonNull(email, "email must not be null");
    if (email.isBlank()) {
      throw new IllegalArgumentException("email must not be blank");
    }
    Objects.requireNonNull(password, "password must not be null");
    if (password.isBlank()) {
      throw new IllegalArgumentException("password must not be blank");
    }
  }
}
