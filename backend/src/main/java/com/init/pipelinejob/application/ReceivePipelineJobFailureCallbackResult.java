package com.init.pipelinejob.application;

public record ReceivePipelineJobFailureCallbackResult(
    String status, String externalEventId, Long pipelineJobId, String jobStatus) {

  public static ReceivePipelineJobFailureCallbackResult of(
      String status, String externalEventId, Long pipelineJobId, String jobStatus) {
    return new ReceivePipelineJobFailureCallbackResult(
        status, externalEventId, pipelineJobId, jobStatus);
  }
}
