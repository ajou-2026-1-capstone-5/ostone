package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

public record LlmToolPolicyResponse(
    Long id,
    String policyCode,
    String name,
    String description,
    String severity,
    JsonNode condition,
    JsonNode action,
    JsonNode evidence,
    JsonNode meta,
    String status,
    String nodeId,
    boolean matched,
    List<String> missingSlotCodes,
    String reason) {}
