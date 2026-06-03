package com.init.workspace.application;

import java.time.OffsetDateTime;

public record WorkspaceDashboardGenerationResult(
    Long pipelineJobId,
    Long datasetId,
    Long domainPackId,
    String status,
    OffsetDateTime requestedAt,
    OffsetDateTime startedAt,
    OffsetDateTime finishedAt,
    String lastErrorMessage) {}
