package com.init.workspace.application;

public record WorkspaceDashboardDecisionSignalResult(
    long decisionLogCount, long missingSlotHitCount, long riskHitCount, long lowConfidenceCount) {}
