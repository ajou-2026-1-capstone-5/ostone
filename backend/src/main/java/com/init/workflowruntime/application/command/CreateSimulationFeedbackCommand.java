package com.init.workflowruntime.application.command;

import com.init.workflowruntime.domain.SimulationFeedbackSeverity;
import com.init.workflowruntime.domain.SimulationFeedbackType;

public record CreateSimulationFeedbackCommand(
    Long workspaceId,
    Long sessionId,
    Long userId,
    Long chatMessageId,
    SimulationFeedbackType feedbackType,
    String description,
    String expectedBehavior,
    SimulationFeedbackSeverity severity) {}
