package com.init.pipelinejob.presentation.dto;

import java.time.OffsetDateTime;

public record DomainPackGenerationTriggerResponse(
    Long pipelineJobId,
    Long workspaceId,
    Long datasetId,
    String jobType,
    String status,
    String airflowDagId,
    String airflowRunId,
    OffsetDateTime requestedAt,
    OffsetDateTime startedAt) {}
