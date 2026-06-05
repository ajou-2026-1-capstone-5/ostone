package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.SimulationGoldenCaseReplayResult;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaSimulationGoldenCaseReplayResultRepository
    extends JpaRepository<SimulationGoldenCaseReplayResult, Long> {

  Optional<SimulationGoldenCaseReplayResult> findTopByGoldenCaseIdOrderByCreatedAtDescIdDesc(
      Long goldenCaseId);

  Page<SimulationGoldenCaseReplayResult> findByGoldenCaseIdOrderByCreatedAtDesc(
      Long goldenCaseId, Pageable pageable);
}
