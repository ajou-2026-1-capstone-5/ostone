package com.init.workflowruntime.application.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record WorkspaceWorkflowBottleneckAnalysisResponse(
    Long workspaceId,
    Long workflowDefinitionId,
    OffsetDateTime periodStart,
    OffsetDateTime periodEnd,
    long totalExecutionCount,
    long completedCount,
    long failedCount,
    long runningCount,
    List<WorkflowTransitionMetricResponse> transitions,
    WorkflowStateBottleneckResponse longestDwellState,
    WorkflowStateBottleneckResponse mostStoppedState,
    List<WorkflowHitMetricResponse> stateMetrics,
    List<WorkflowHitMetricResponse> missingSlotTop,
    List<WorkflowHitMetricResponse> policyHitTop,
    List<WorkflowHitMetricResponse> riskHitTop,
    List<WorkflowHumanInterventionMetricResponse> humanInterventionPoints,
    List<String> improvementHints) {}
