package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class PipelineJobCallbackTargetMismatchException extends DuplicateException {

  public PipelineJobCallbackTargetMismatchException(
      Long jobId, Long jobDomainPackId, Long domainPackVersionId, Long versionDomainPackId) {
    super(
        "PIPELINE_JOB_CALLBACK_TARGET_MISMATCH",
        "Pipeline job과 callback target version이 일치하지 않습니다. jobId="
            + jobId
            + ", jobDomainPackId="
            + jobDomainPackId
            + ", domainPackVersionId="
            + domainPackVersionId
            + ", versionDomainPackId="
            + versionDomainPackId);
  }
}
