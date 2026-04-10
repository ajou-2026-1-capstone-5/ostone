package com.init.auth.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class EmailAlreadyExistsException extends DuplicateException {
  public EmailAlreadyExistsException(String message) {
    super("EMAIL_ALREADY_EXISTS", message);
  }
}
