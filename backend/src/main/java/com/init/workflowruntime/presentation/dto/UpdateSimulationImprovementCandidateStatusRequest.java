package com.init.workflowruntime.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateSimulationImprovementCandidateStatusRequest(
    @NotBlank(message = "status는 필수 항목입니다.") String status) {}
