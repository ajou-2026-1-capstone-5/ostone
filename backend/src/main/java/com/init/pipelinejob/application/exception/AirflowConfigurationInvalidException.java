package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.InternalException;

public class AirflowConfigurationInvalidException extends InternalException {

  public AirflowConfigurationInvalidException() {
    super("AIRFLOW_CONFIGURATION_INVALID", "Airflow API 설정이 올바르지 않습니다.");
  }

  public AirflowConfigurationInvalidException(Throwable cause) {
    super("AIRFLOW_CONFIGURATION_INVALID", "Airflow API 설정이 올바르지 않습니다.", cause);
  }
}
