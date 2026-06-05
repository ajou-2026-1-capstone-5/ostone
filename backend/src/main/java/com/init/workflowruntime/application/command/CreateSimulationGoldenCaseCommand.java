package com.init.workflowruntime.application.command;

import com.fasterxml.jackson.databind.JsonNode;

public record CreateSimulationGoldenCaseCommand(
    Long workspaceId,
    Long sessionId,
    Long userId,
    String name,
    String expectedIntentCode,
    String expectedWorkflowCode,
    String expectedCurrentState,
    String expectedActionType,
    JsonNode expectedSlotValues) {}
