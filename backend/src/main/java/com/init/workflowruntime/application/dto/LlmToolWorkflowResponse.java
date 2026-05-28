package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record LlmToolWorkflowResponse(
    Long sessionId,
    Long workspaceId,
    Long domainPackId,
    Long domainPackVersionId,
    Long executionId,
    String executionStatus,
    String currentState,
    Long workflowDefinitionId,
    String workflowCode,
    String workflowName,
    String workflowDescription,
    JsonNode graphJson,
    String initialState,
    JsonNode terminalStates) {}
