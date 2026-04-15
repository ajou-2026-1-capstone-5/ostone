package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class PipelineJobCallbackNotAllowedException extends DuplicateException {

  public PipelineJobCallbackNotAllowedException(Long jobId, String status, String callbackType) {
    super(
        "PIPELINE_JOB_CALLBACK_NOT_ALLOWED",
        "현재 상태에서는 callback을 처리할 수 없습니다. id="
            + jobId
            + ", status="
            + status
            + ", callbackType="
            + callbackType);
  }
}
