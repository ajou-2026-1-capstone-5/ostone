package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record LlmToolIntentResponse(
    Long id,
    String intentCode,
    String name,
    String description,
    Integer taxonomyLevel,
    Long parentIntentId,
    String status,
    JsonNode entryCondition,
    JsonNode meta) {}
