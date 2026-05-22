package com.init.workflowruntime.domain;

import com.init.shared.application.exception.BadRequestException;

public class InvalidSessionStateException extends BadRequestException {

  public InvalidSessionStateException(String message) {
    super("INVALID_SESSION_STATE", message);
  }
}
