package com.init.workflowruntime.application.command;

public record RejectSimulationImprovementCandidateCommand(
    Long workspaceId, Long userId, Long candidateId, String reason) {}
