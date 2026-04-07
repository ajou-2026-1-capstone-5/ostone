package com.init.auth.application.exception;

public class EmailAlreadyExistsException extends AuthException {

  public EmailAlreadyExistsException(String message) {
    super(message);
  }
}
