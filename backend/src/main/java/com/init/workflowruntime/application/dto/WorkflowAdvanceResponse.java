package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

public record WorkflowAdvanceResponse(
    Long sessionId,
    Long executionId,
    String executionStatus,
    String previousState,
    String currentState,
    String currentNodeType,
    String actionType,
    String edgeId,
    String targetState,
    List<String> missingSlotCodes,
    JsonNode condition,
    JsonNode policySnapshot,
    LlmToolPolicyResponse transitionPolicy,
    LlmToolPolicyResponse currentPolicy,
    String reason) {}
