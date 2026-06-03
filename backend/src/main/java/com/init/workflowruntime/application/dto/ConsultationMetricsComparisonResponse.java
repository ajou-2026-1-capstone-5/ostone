package com.init.workflowruntime.application.dto;

public record ConsultationMetricsComparisonResponse(
    Double totalConsultationCountChangeRate,
    Double completedConsultationCountChangeRate,
    Double averageFirstResponseSecondsChangeRate,
    Double averageLlmFirstResponseSecondsChangeRate,
    Double averageHumanFirstResponseSecondsChangeRate,
    Double llmHandledCountChangeRate,
    Double humanInterventionCountChangeRate,
    Double unresolvedSessionCountChangeRate) {}
