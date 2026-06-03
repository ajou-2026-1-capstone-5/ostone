package com.init.pipelinejob.presentation.dto;

import com.init.pipelinejob.application.RetryAdminPipelineJobResult;
import java.time.OffsetDateTime;

public record RetryAdminPipelineJobResponse(
    Long sourcePipelineJobId,
    Long retryPipelineJobId,
    Long workspaceId,
    Long datasetId,
    String jobType,
    String status,
    String airflowDagId,
    String airflowRunId,
    OffsetDateTime requestedAt,
    OffsetDateTime startedAt) {

  public static RetryAdminPipelineJobResponse from(RetryAdminPipelineJobResult result) {
    return new RetryAdminPipelineJobResponse(
        result.sourcePipelineJobId(),
        result.retryPipelineJobId(),
        result.workspaceId(),
        result.datasetId(),
        result.jobType(),
        result.status(),
        result.airflowDagId(),
        result.airflowRunId(),
        result.requestedAt(),
        result.startedAt());
  }
}
