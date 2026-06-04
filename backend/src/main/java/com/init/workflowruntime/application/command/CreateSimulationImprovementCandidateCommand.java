package com.init.workflowruntime.application.command;

public record CreateSimulationImprovementCandidateCommand(
    Long workspaceId,
    Long userId,
    Long feedbackId,
    String targetElementType,
    Long targetElementId,
    String targetElementKey,
    String beforeSummary,
    String afterSummary) {}
