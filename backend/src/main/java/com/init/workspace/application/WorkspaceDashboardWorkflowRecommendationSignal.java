package com.init.workspace.application;

public record WorkspaceDashboardWorkflowRecommendationSignal(
    Long workflowDefinitionId,
    Long domainPackId,
    Long domainPackVersionId,
    String workflowName,
    long executionCount,
    Double completionRate,
    Double changeRate) {}
