package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.InvalidCredentialsException;

public class AirflowWebhookUnauthorizedException extends InvalidCredentialsException {

  public AirflowWebhookUnauthorizedException() {
    super("UNAUTHORIZED", "유효하지 않은 Airflow webhook secret입니다.");
  }
}
