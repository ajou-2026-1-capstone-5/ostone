package com.init.workspace.application;

import java.time.OffsetDateTime;

public record AdminCustomerPipelineJobResult(
    Long id,
    String jobType,
    String status,
    OffsetDateTime requestedAt,
    OffsetDateTime startedAt,
    OffsetDateTime finishedAt) {}
