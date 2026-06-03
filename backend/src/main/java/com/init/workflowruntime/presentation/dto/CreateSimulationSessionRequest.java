package com.init.workflowruntime.presentation.dto;

import jakarta.validation.constraints.Size;

public record CreateSimulationSessionRequest(
    @Size(max = 100) String customerName,
    @Size(max = 255) String intentCode,
    Long workflowDefinitionId) {}
