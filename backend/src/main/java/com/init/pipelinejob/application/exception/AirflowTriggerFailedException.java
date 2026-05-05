package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.BadGatewayException;

public class AirflowTriggerFailedException extends BadGatewayException {

  private final Long pipelineJobId;

  public AirflowTriggerFailedException(Long pipelineJobId) {
    this(pipelineJobId, "Domain Pack Generation DAG 실행 요청에 실패했습니다.");
  }

  public AirflowTriggerFailedException(Long pipelineJobId, String message) {
    super("AIRFLOW_TRIGGER_FAILED", message);
    this.pipelineJobId = pipelineJobId;
  }

  public Long getPipelineJobId() {
    return pipelineJobId;
  }
}
