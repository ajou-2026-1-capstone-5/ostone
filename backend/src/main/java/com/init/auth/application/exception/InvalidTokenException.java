package com.init.auth.application.exception;

public class InvalidTokenException extends AuthException {

  public InvalidTokenException(String message) {
    super(message);
  }
}
