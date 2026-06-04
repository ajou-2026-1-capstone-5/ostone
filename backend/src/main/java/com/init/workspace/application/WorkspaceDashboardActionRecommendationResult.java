package com.init.workspace.application;

public record WorkspaceDashboardActionRecommendationResult(
    String ruleCode,
    int priority,
    String title,
    String description,
    String evidenceLabel,
    String evidenceValue,
    String targetPath) {}
