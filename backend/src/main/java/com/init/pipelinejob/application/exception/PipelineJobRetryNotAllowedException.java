package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class PipelineJobRetryNotAllowedException extends BadRequestException {

  public PipelineJobRetryNotAllowedException(Long pipelineJobId, String reason) {
    super(
        "PIPELINE_JOB_RETRY_NOT_ALLOWED",
        "Pipeline job을 재시도할 수 없습니다. id=" + pipelineJobId + ", reason=" + reason);
  }
}
