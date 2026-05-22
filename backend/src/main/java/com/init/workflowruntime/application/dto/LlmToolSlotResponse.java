package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record LlmToolSlotResponse(
    Long id,
    String slotCode,
    String name,
    String description,
    String dataType,
    Boolean isSensitive,
    JsonNode validationRule,
    JsonNode defaultValue,
    JsonNode meta,
    String status,
    Boolean required,
    Integer collectionOrder,
    String promptHint,
    boolean hasValue,
    JsonNode value) {}
