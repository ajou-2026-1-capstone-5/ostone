package com.init.domainpack.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class PolicyDefinitionNotFoundException extends NotFoundException {
  public PolicyDefinitionNotFoundException(Long policyId) {
    super("POLICY_DEFINITION_NOT_FOUND", "PolicyDefinition not found: " + policyId);
  }
}
