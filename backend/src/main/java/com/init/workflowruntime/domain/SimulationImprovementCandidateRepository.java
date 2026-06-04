package com.init.workflowruntime.domain;

import java.util.Optional;

public interface SimulationImprovementCandidateRepository {

  SimulationImprovementCandidate save(SimulationImprovementCandidate candidate);

  Optional<SimulationImprovementCandidate> findById(Long id);

  Optional<SimulationImprovementCandidate> findByFeedbackId(Long feedbackId);

  DomainPage<SimulationImprovementCandidate> findByWorkspaceId(
      Long workspaceId, DomainPageRequest pageRequest);

  DomainPage<SimulationImprovementCandidate> findByWorkspaceIdAndStatus(
      Long workspaceId, SimulationImprovementCandidateStatus status, DomainPageRequest pageRequest);
}
