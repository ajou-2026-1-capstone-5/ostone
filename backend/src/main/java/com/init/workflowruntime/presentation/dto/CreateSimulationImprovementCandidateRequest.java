package com.init.workflowruntime.presentation.dto;

import jakarta.validation.constraints.Size;

public record CreateSimulationImprovementCandidateRequest(
    String targetElementType,
    Long targetElementId,
    @Size(max = 255, message = "targetElementKey는 255자 이하여야 합니다.") String targetElementKey,
    @Size(max = 2000, message = "beforeSummary는 2000자 이하여야 합니다.") String beforeSummary,
    @Size(max = 2000, message = "afterSummary는 2000자 이하여야 합니다.") String afterSummary) {}
