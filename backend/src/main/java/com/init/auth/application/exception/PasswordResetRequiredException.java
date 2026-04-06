package com.init.auth.application.exception;

public class PasswordResetRequiredException extends AuthException {

  public PasswordResetRequiredException(String message) {
    super(message);
  }
}
