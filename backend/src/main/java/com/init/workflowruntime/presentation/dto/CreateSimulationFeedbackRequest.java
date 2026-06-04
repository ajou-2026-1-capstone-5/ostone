package com.init.workflowruntime.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateSimulationFeedbackRequest(
    Long chatMessageId,
    @NotNull SimulationFeedbackTypeRequest feedbackType,
    @NotBlank @Size(max = 2000) String description,
    @NotBlank @Size(max = 2000) String expectedBehavior,
    @NotNull SimulationFeedbackSeverityRequest severity) {}
