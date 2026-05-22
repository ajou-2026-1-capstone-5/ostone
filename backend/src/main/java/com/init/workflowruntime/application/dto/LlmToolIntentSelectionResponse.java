package com.init.workflowruntime.application.dto;

import java.util.List;

public record LlmToolIntentSelectionResponse(
    Long sessionId,
    Long executionId,
    Long intentDefinitionId,
    String intentCode,
    String intentName,
    Long workflowDefinitionId,
    String workflowCode,
    String currentState,
    boolean slotCollectionRequired,
    List<String> missingRequiredSlots,
    List<LlmToolSlotResponse> requiredSlots) {}
