package com.init.workspace.application;

public record WorkspaceDashboardSimulationSignalResult(
    long openFeedbackCount,
    long readyForReviewCandidateCount,
    long failedGoldenCaseCount,
    String topOpenFeedbackType,
    long topOpenFeedbackTypeCount) {}
