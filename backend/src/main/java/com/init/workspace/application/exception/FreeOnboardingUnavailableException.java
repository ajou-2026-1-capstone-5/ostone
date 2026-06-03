package com.init.workspace.application.exception;

import com.init.shared.application.exception.BadRequestException;

@SuppressWarnings("java:S110")
public class FreeOnboardingUnavailableException extends BadRequestException {

  public FreeOnboardingUnavailableException(String message) {
    super("FREE_ONBOARDING_UNAVAILABLE", message);
  }
}
