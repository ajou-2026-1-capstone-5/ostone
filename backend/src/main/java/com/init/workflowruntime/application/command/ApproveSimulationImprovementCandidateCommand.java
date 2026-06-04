package com.init.workflowruntime.application.command;

public record ApproveSimulationImprovementCandidateCommand(
    Long workspaceId, Long userId, Long candidateId, String reason) {}
