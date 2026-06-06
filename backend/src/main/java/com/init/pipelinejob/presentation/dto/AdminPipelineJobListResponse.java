package com.init.pipelinejob.presentation.dto;

import com.init.pipelinejob.application.AdminPipelineJobListResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;

public record AdminPipelineJobListResponse(
    List<Item> items, int page, int size, long totalElements, int totalPages) {

  public static AdminPipelineJobListResponse from(AdminPipelineJobListResult result) {
    return new AdminPipelineJobListResponse(
        result.items().stream().map(Item::from).toList(),
        result.page(),
        result.size(),
        result.totalElements(),
        result.totalPages());
  }

  @Schema(name = "AdminPipelineJobListItem")
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
      Long retryPipelineJobId) {

    public static Item from(AdminPipelineJobListResult.Item item) {
      return new Item(
          item.pipelineJobId(),
          item.workspaceId(),
          item.datasetId(),
          item.domainPackId(),
          item.jobType(),
          item.status(),
          item.airflowDagId(),
          item.airflowRunId(),
          item.requestedAt(),
          item.startedAt(),
          item.finishedAt(),
          item.queueLagSeconds(),
          item.runningDurationSeconds(),
          item.totalDurationSeconds(),
          item.lagExceeded(),
          item.lastErrorMessage(),
          item.retriedFromPipelineJobId(),
          item.retryPipelineJobId());
    }
  }
}
