package com.init.pipelinejob.application;

import java.time.OffsetDateTime;

public record RetryAdminPipelineJobResult(
    Long sourcePipelineJobId,
    Long retryPipelineJobId,
    Long workspaceId,
    Long datasetId,
    String jobType,
    String status,
    String airflowDagId,
    String airflowRunId,
    OffsetDateTime requestedAt,
    OffsetDateTime startedAt) {}
