package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class PipelineJobAlreadySucceededException extends DuplicateException {

  public PipelineJobAlreadySucceededException(Long jobId) {
    super("PIPELINE_JOB_ALREADY_SUCCEEDED", "이미 성공한 pipeline job입니다. id=" + jobId);
  }
}
