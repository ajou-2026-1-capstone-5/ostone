package com.init.pipelinejob.application;

import java.time.OffsetDateTime;
import java.util.List;

public record AdminPipelineJobListResult(
    List<Item> items, int page, int size, long totalElements, int totalPages) {

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
      Long queueLagSeconds,
      Long runningDurationSeconds,
      Long totalDurationSeconds,
      boolean lagExceeded,
      String lastErrorMessage,
      Long retriedFromPipelineJobId,
      Long retryPipelineJobId) {}
}
