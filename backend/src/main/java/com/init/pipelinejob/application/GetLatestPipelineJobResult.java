package com.init.pipelinejob.application;

import java.time.OffsetDateTime;

public record GetLatestPipelineJobResult(
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
    String lastErrorMessage) {}
