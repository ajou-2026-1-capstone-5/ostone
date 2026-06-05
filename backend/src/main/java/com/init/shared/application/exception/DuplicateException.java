package com.init.shared.application.exception;

public class DuplicateException extends BusinessException {
  public DuplicateException(String code, String message) {
    super(code, message);
  }

  public DuplicateException(String code, String message, Throwable cause) {
    super(code, message, cause);
  }
}
