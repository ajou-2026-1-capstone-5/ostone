package com.init.pipelinejob.application;

import java.time.OffsetDateTime;

public record TriggerDomainPackGenerationResult(
    Long pipelineJobId,
    Long workspaceId,
    Long datasetId,
    String jobType,
    String status,
    String airflowDagId,
    String airflowRunId,
    OffsetDateTime requestedAt,
    OffsetDateTime startedAt) {}
