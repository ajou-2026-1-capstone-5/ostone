package com.init.workflowruntime.application.command;

import com.fasterxml.jackson.databind.JsonNode;

public record UpsertLlmToolSlotValueCommand(Long sessionId, String slotCode, JsonNode value) {}
