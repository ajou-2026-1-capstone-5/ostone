package com.init.auth.application.exception;

public class PasswordResetRequiredException extends AuthException {

  private final String resetToken;

  public PasswordResetRequiredException(String message, String resetToken) {
    super(message);
    this.resetToken = resetToken;
  }

  public String getResetToken() {
    return resetToken;
  }
}
