package com.init.shared.application.exception;

public class InternalException extends BusinessException {
  public InternalException(String code, String message) {
    super(code, message);
  }
}
