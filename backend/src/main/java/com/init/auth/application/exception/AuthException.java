package com.init.auth.application.exception;

import com.init.shared.application.exception.BusinessException;

public class AuthException extends BusinessException {
  protected AuthException(String code, String message) {
    super(code, message);
  }
}
