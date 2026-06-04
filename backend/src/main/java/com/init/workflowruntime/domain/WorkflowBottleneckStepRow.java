package com.init.workflowruntime.domain;

import java.time.OffsetDateTime;

public record WorkflowBottleneckStepRow(
    Long executionId,
    String stateFrom,
    String stateTo,
    String actionType,
    OffsetDateTime createdAt) {}
