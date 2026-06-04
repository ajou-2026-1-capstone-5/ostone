package com.init.workflowruntime.domain;

public record SimulationFeedbackContent(
    SimulationFeedbackType feedbackType,
    String description,
    String expectedBehavior,
    SimulationFeedbackSeverity severity) {}
