package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.SimulationGoldenCase;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaSimulationGoldenCaseRepository
    extends JpaRepository<SimulationGoldenCase, Long> {

  Optional<SimulationGoldenCase> findByIdAndWorkspaceId(Long id, Long workspaceId);

  Page<SimulationGoldenCase> findByWorkspaceIdOrderByCreatedAtDesc(
      Long workspaceId, Pageable pageable);
}
