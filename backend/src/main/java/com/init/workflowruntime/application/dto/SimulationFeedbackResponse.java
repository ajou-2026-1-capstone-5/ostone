package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.SimulationFeedback;
import com.init.workflowruntime.domain.SimulationFeedbackSeverity;
import com.init.workflowruntime.domain.SimulationFeedbackStatus;
import com.init.workflowruntime.domain.SimulationFeedbackType;
import java.time.OffsetDateTime;

public record SimulationFeedbackResponse(
    Long id,
    Long workspaceId,
    Long sessionId,
    Long chatMessageId,
    SimulationFeedbackType feedbackType,
    String description,
    String expectedBehavior,
    SimulationFeedbackSeverity severity,
    SimulationFeedbackStatus status,
    Long createdBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static SimulationFeedbackResponse from(SimulationFeedback feedback) {
    return new SimulationFeedbackResponse(
        feedback.getId(),
        feedback.getWorkspaceId(),
        feedback.getChatSessionId(),
        feedback.getChatMessageId(),
        feedback.getFeedbackType(),
        feedback.getDescription(),
        feedback.getExpectedBehavior(),
        feedback.getSeverity(),
        feedback.getStatus(),
        feedback.getCreatedBy(),
        feedback.getCreatedAt(),
        feedback.getUpdatedAt());
  }
}
