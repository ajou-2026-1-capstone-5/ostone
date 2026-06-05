package com.init.auth.application.exception;

import com.init.shared.application.exception.UnauthorizedException;

public class PasswordResetRequiredException extends UnauthorizedException {
  public PasswordResetRequiredException(String message) {
    super("PASSWORD_RESET_REQUIRED", message);
  }
}
