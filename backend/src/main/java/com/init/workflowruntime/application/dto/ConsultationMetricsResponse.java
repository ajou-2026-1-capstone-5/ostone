package com.init.workflowruntime.application.dto;

import java.time.OffsetDateTime;

public record ConsultationMetricsResponse(
    Long workspaceId,
    OffsetDateTime periodStart,
    OffsetDateTime periodEnd,
    long totalConsultationCount,
    long completedConsultationCount,
    Long averageFirstResponseSeconds,
    Long averageLlmFirstResponseSeconds,
    Long averageHumanFirstResponseSeconds,
    long llmHandledCount,
    long humanInterventionCount,
    long unresolvedSessionCount,
    ConsultationMetricsComparisonResponse comparison,
    long handledTodayCount,
    long llmHandledTodayCount,
    long humanHandledTodayCount) {}
