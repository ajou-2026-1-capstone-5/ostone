package com.init.workflowruntime.presentation.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.Size;

public record CreateSimulationGoldenCaseRequest(
    @Size(max = 255) String name,
    @Size(max = 255) String expectedIntentCode,
    @Size(max = 255) String expectedWorkflowCode,
    @Size(max = 255) String expectedCurrentState,
    @Size(max = 255) String expectedActionType,
    JsonNode expectedSlotValues) {}
