package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

public record SimulationSessionDetailResponse(
    ChatSessionResponse session,
    List<ChatMessageResponse> messages,
    LlmToolWorkflowResponse matchedWorkflow,
    JsonNode slotValues,
    List<LlmToolSlotResponse> slots,
    SimulationFeedbackSessionResponse feedback) {}
