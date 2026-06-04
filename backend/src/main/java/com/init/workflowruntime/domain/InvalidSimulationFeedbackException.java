package com.init.workflowruntime.domain;

import com.init.shared.application.exception.BadRequestException;

public class InvalidSimulationFeedbackException extends BadRequestException {

  public InvalidSimulationFeedbackException(String message) {
    super("INVALID_SIMULATION_FEEDBACK", message);
  }
}
