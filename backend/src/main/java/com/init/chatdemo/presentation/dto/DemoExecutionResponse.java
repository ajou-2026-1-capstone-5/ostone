package com.init.chatdemo.presentation.dto;

import java.util.List;
import java.util.Map;

public record DemoExecutionResponse(
    String id,
    String status,
    String currentState,
    String currentNodeId,
    String intent,
    Map<String, Object> slotValues,
    List<String> missingSlots,
    List<DemoPolicyHitResponse> policyHits,
    List<DemoRiskHitResponse> riskHits) {}
