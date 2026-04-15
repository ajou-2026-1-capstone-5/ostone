package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class PipelineJobAlreadyFinalizedException extends DuplicateException {

  public PipelineJobAlreadyFinalizedException(Long jobId) {
    super("PIPELINE_JOB_ALREADY_FINALIZED", "이미 종료된 pipeline job입니다. id=" + jobId);
  }
}
