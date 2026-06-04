package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.SimulationFeedback;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public record SimulationFeedbackSessionResponse(
    List<SimulationFeedbackResponse> items, Map<Long, Long> messageFeedbackCounts) {

  public static SimulationFeedbackSessionResponse from(List<SimulationFeedback> feedbacks) {
    Map<Long, Long> messageFeedbackCounts =
        feedbacks.stream()
            .filter(feedback -> feedback.getChatMessageId() != null)
            .collect(
                Collectors.groupingBy(SimulationFeedback::getChatMessageId, Collectors.counting()));
    return new SimulationFeedbackSessionResponse(
        feedbacks.stream().map(SimulationFeedbackResponse::from).toList(), messageFeedbackCounts);
  }
}
