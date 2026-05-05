package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class PipelineJobAlreadyRunningException extends DuplicateException {

  private final Long pipelineJobId;
  private final String status;

  public PipelineJobAlreadyRunningException(Long pipelineJobId, String status) {
    super("PIPELINE_JOB_ALREADY_RUNNING", "해당 dataset에 대해 진행 중인 Domain Pack Generation 작업이 있습니다.");
    this.pipelineJobId = pipelineJobId;
    this.status = status;
  }

  public Long getPipelineJobId() {
    return pipelineJobId;
  }

  public String getStatus() {
    return status;
  }
}
