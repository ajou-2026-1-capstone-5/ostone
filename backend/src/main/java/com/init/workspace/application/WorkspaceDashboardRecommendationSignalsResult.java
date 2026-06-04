package com.init.workspace.application;

import java.time.OffsetDateTime;

public record WorkspaceDashboardRecommendationSignalsResult(
    OffsetDateTime periodStart,
    OffsetDateTime periodEnd,
    WorkspaceDashboardHealthResult health,
    WorkspaceDashboardDecisionSignalResult currentDecisionSignals,
    WorkspaceDashboardDecisionSignalResult previousDecisionSignals,
    WorkspaceDashboardWorkflowRecommendationSignal hotpathSurgeWorkflow,
    WorkspaceDashboardWorkflowRecommendationSignal lowCompletionWorkflow) {}
