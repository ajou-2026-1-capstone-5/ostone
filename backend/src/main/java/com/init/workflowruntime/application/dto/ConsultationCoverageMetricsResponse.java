package com.init.workflowruntime.application.dto;

import java.util.List;

public record ConsultationCoverageMetricsResponse(
    long workflowMatchedCount,
    Double workflowMatchRate,
    long intentClassificationSuccessCount,
    Double intentClassificationSuccessRate,
    long lowConfidenceCount,
    Double lowConfidenceRate,
    long unmatchedSessionCount,
    long autoCompletedWorkflowCount,
    Double humanHandoffRate,
    Double llmOnlyProcessingRate,
    String measurementStatus,
    String measurementMessage,
    List<ConsultationCoverageTrendPointResponse> trend) {}
