package com.init.auth.application.exception;

import com.init.shared.application.exception.UnauthorizedException;

public class PasswordResetRequiredException extends UnauthorizedException {
  private final String resetToken;

  public PasswordResetRequiredException(String message, String resetToken) {
    super("PASSWORD_RESET_REQUIRED", message);
    this.resetToken = resetToken;
  }

  public String getResetToken() {
    return resetToken;
  }
}
