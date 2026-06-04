package com.init.workflowruntime.application.command;

public record UpdateSimulationImprovementCandidateStatusCommand(
    Long workspaceId, Long userId, Long candidateId, String status) {}
