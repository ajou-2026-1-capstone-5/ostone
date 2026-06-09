package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.SimulationImprovementCandidate;
import java.util.List;
import java.util.function.Function;

public record SimulationImprovementCandidatePageResponse(
    List<SimulationImprovementCandidateResponse> content,
    int page,
    int size,
    long totalElements,
    int totalPages) {

  public static SimulationImprovementCandidatePageResponse from(
      DomainPage<SimulationImprovementCandidate> page,
      Function<SimulationImprovementCandidate, SimulationImprovementCandidateResponse> mapper) {
    return new SimulationImprovementCandidatePageResponse(
        page.content().stream().map(mapper).toList(),
        page.page(),
        page.size(),
        page.totalElements(),
        page.totalPages());
  }
}
