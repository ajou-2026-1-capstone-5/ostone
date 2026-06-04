package com.init.workflowruntime.domain;

import com.init.shared.application.exception.BadRequestException;

public class InvalidSimulationImprovementCandidateException extends BadRequestException {

  public InvalidSimulationImprovementCandidateException(String message) {
    super("INVALID_SIMULATION_IMPROVEMENT_CANDIDATE", message);
  }
}
