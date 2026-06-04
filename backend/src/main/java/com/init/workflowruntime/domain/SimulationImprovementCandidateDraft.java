package com.init.workflowruntime.domain;

public record SimulationImprovementCandidateDraft(
    SimulationImprovementCandidateType candidateType,
    SimulationImprovementCandidateTargetType targetElementType,
    Long targetElementId,
    String targetElementKey,
    String beforeSummary,
    String afterSummary,
    String evidenceSummary) {}
