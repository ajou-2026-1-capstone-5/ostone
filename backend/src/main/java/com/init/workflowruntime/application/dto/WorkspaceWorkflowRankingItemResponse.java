package com.init.workflowruntime.application.dto;

public record WorkspaceWorkflowRankingItemResponse(
    int rank,
    Long workflowDefinitionId,
    Long domainPackId,
    Long domainPackVersionId,
    String workflowCode,
    String workflowName,
    long executionCount,
    double shareRate,
    long completedCount,
    long failedCount,
    long runningCount,
    double completionRate,
    double failureRate,
    Long averageHandlingSeconds,
    double humanInterventionRate,
    Double changeRate,
    boolean surging,
    String detailPath) {}
