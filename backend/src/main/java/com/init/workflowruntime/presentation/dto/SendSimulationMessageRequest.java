package com.init.workflowruntime.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendSimulationMessageRequest(@NotBlank @Size(max = 4000) String content) {}
