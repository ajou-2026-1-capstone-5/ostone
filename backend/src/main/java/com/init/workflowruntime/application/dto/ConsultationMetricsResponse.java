package com.init.workflowruntime.application.dto;

import java.time.OffsetDateTime;

public record ConsultationMetricsResponse(
    Long workspaceId,
    OffsetDateTime periodStart,
    OffsetDateTime periodEnd,
    Long averageFirstResponseSeconds,
    Long averageLlmFirstResponseSeconds,
    Long averageHumanFirstResponseSeconds,
    long handledTodayCount,
    long llmHandledTodayCount,
    long humanHandledTodayCount) {}
