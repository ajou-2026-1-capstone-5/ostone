package com.init.workflowruntime.application.command;

public record ReplaySimulationGoldenCaseCommand(
    Long workspaceId, Long goldenCaseId, Long domainPackVersionId, Long userId) {}
