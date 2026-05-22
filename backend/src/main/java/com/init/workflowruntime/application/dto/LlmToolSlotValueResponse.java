package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record LlmToolSlotValueResponse(
    Long sessionId, Long executionId, String slotCode, boolean hasValue, JsonNode value) {}
