package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.SimulationImprovementCandidate;
import java.util.List;

public record SimulationImprovementCandidatePageResponse(
    List<SimulationImprovementCandidateResponse> content,
    int page,
    int size,
    long totalElements,
    int totalPages) {

  public static SimulationImprovementCandidatePageResponse from(
      DomainPage<SimulationImprovementCandidate> page) {
    return new SimulationImprovementCandidatePageResponse(
        page.content().stream().map(SimulationImprovementCandidateResponse::from).toList(),
        page.page(),
        page.size(),
        page.totalElements(),
        page.totalPages());
  }
}
