package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class PipelineJobRetryInputMissingException extends BadRequestException {

  public PipelineJobRetryInputMissingException(Long pipelineJobId, String fieldName) {
    super(
        "PIPELINE_JOB_RETRY_INPUT_MISSING",
        "Pipeline job 재시도 입력을 확인할 수 없습니다. id=" + pipelineJobId + ", field=" + fieldName);
  }
}
