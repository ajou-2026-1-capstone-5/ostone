package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record LlmToolPolicyContextResponse(
    Long sessionId,
    Long executionId,
    String currentState,
    JsonNode policySnapshot,
    LlmToolPolicyResponse currentPolicy) {}
