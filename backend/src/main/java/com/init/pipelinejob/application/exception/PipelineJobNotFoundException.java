package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class PipelineJobNotFoundException extends NotFoundException {

  public PipelineJobNotFoundException(Long jobId) {
    super("PIPELINE_JOB_NOT_FOUND", "Pipeline job을 찾을 수 없습니다. id=" + jobId);
  }
}
