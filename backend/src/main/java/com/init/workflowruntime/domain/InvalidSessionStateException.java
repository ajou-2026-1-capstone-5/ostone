package com.init.workflowruntime.domain;

import com.init.shared.application.exception.BusinessException;

public class InvalidSessionStateException extends BusinessException {

  public InvalidSessionStateException(String message) {
    super("INVALID_SESSION_STATE", message);
  }
}
