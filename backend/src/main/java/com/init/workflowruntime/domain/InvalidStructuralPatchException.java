package com.init.workflowruntime.domain;

import com.init.shared.application.exception.BadRequestException;

public class InvalidStructuralPatchException extends BadRequestException {

  public InvalidStructuralPatchException(String message) {
    super("INVALID_STRUCTURAL_PATCH", message);
  }
}
