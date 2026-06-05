package com.init.pipelinejob.presentation.dto;

import com.init.pipelinejob.application.GetLatestPipelineJobResult;
import java.time.OffsetDateTime;

public record LatestPipelineJobResponse(Item pipelineJob) {

  public static LatestPipelineJobResponse empty() {
    return new LatestPipelineJobResponse(null);
  }

  public static LatestPipelineJobResponse from(GetLatestPipelineJobResult result) {
    return new LatestPipelineJobResponse(Item.from(result));
  }

  public record Item(
      Long pipelineJobId,
      Long workspaceId,
      Long datasetId,
      Long domainPackId,
      String jobType,
      String status,
      String airflowDagId,
      String airflowRunId,
      OffsetDateTime requestedAt,
      OffsetDateTime startedAt,
      OffsetDateTime finishedAt,
      Long runningDurationSeconds,
      String lastErrorMessage) {

    public static Item from(GetLatestPipelineJobResult result) {
      return new Item(
          result.pipelineJobId(),
          result.workspaceId(),
          result.datasetId(),
          result.domainPackId(),
          result.jobType(),
          result.status(),
          result.airflowDagId(),
          result.airflowRunId(),
          result.requestedAt(),
          result.startedAt(),
          result.finishedAt(),
          result.runningDurationSeconds(),
          result.lastErrorMessage());
    }
  }
}
