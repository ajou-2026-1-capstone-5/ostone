package com.init.workflowruntime.domain;

import java.time.OffsetDateTime;

public record WorkflowBottleneckExecutionRow(
    Long executionId,
    String status,
    String currentState,
    OffsetDateTime startedAt,
    OffsetDateTime finishedAt) {}
