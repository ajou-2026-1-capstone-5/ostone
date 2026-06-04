package com.init.workflowruntime.domain;

import java.time.OffsetDateTime;

public record WorkflowRankingExecutionRow(
    Long executionId,
    Long workflowDefinitionId,
    Long domainPackId,
    Long domainPackVersionId,
    String workflowCode,
    String workflowName,
    String status,
    OffsetDateTime startedAt,
    OffsetDateTime finishedAt,
    boolean hasHumanMessage) {}
