package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.SimulationFeedback;
import java.util.List;

public record SimulationFeedbackPageResponse(
    List<SimulationFeedbackResponse> content,
    int page,
    int size,
    long totalElements,
    int totalPages) {

  public static SimulationFeedbackPageResponse from(DomainPage<SimulationFeedback> page) {
    return new SimulationFeedbackPageResponse(
        page.content().stream().map(SimulationFeedbackResponse::from).toList(),
        page.page(),
        page.size(),
        page.totalElements(),
        page.totalPages());
  }
}
