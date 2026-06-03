package com.init.workflowruntime.application.command;

public record CreateSimulationSessionCommand(
    Long workspaceId,
    Long userId,
    String customerName,
    String intentCode,
    Long workflowDefinitionId) {}
