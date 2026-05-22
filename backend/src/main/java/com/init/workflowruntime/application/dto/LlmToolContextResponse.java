package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

public record LlmToolContextResponse(
    Long sessionId,
    Long workspaceId,
    Long domainPackVersionId,
    Long executionId,
    String executionStatus,
    String currentState,
    JsonNode slotValues,
    List<String> missingSlots,
    List<LlmToolSlotResponse> slots) {}
