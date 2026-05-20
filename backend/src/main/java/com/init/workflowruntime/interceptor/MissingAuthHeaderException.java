package com.init.workflowruntime.interceptor;

import com.init.shared.application.exception.BusinessException;

public class MissingAuthHeaderException extends BusinessException {

  public MissingAuthHeaderException(String message) {
    super("MISSING_AUTH_HEADER", message);
  }
}
