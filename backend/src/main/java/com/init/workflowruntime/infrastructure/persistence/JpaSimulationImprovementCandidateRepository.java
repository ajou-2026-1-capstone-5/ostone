package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.SimulationImprovementCandidate;
import com.init.workflowruntime.domain.SimulationImprovementCandidateStatus;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaSimulationImprovementCandidateRepository
    extends JpaRepository<SimulationImprovementCandidate, Long> {

  Optional<SimulationImprovementCandidate> findByFeedbackId(Long feedbackId);

  Page<SimulationImprovementCandidate> findByWorkspaceIdOrderByCreatedAtDesc(
      Long workspaceId, Pageable pageable);

  Page<SimulationImprovementCandidate> findByWorkspaceIdAndStatusOrderByCreatedAtDesc(
      Long workspaceId, SimulationImprovementCandidateStatus status, Pageable pageable);
}
