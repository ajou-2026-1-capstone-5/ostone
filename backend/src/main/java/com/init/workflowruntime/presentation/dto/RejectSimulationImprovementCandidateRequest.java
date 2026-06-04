package com.init.workflowruntime.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record RejectSimulationImprovementCandidateRequest(
    @NotBlank(message = "reason은 필수 항목입니다.") String reason) {}
