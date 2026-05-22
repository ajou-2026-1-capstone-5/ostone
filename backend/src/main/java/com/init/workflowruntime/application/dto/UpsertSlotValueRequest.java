package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;

public record UpsertSlotValueRequest(@NotNull JsonNode value) {}
