package com.init.domainpack.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class RiskDefinitionNotFoundException extends NotFoundException {
  public RiskDefinitionNotFoundException(Long riskId) {
    super("RISK_DEFINITION_NOT_FOUND", "RiskDefinition not found: " + riskId);
  }
}
