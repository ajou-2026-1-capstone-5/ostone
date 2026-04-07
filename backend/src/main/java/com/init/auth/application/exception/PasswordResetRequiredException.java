package com.init.auth.application.exception;

import java.util.Objects;

public class PasswordResetRequiredException extends AuthException {

  private final String resetToken;

  public PasswordResetRequiredException(String message, String resetToken) {
    super(Objects.requireNonNull(message, "message must not be null"));
    this.resetToken = Objects.requireNonNull(resetToken, "resetToken must not be null");
  }

  public String getResetToken() {
    return resetToken;
  }
}
