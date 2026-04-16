package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class PipelineJobConflictException extends DuplicateException {

  public PipelineJobConflictException(Long jobId) {
    super("PIPELINE_JOB_CONFLICT", "동시 업데이트 충돌로 pipeline job을 처리할 수 없습니다. id=" + jobId);
  }
}
