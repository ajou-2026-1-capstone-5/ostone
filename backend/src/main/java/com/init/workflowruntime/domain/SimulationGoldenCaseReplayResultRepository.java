package com.init.workflowruntime.domain;

import java.util.Optional;

public interface SimulationGoldenCaseReplayResultRepository {

  SimulationGoldenCaseReplayResult save(SimulationGoldenCaseReplayResult replayResult);

  Optional<SimulationGoldenCaseReplayResult> findLatestByGoldenCaseId(Long goldenCaseId);

  DomainPage<SimulationGoldenCaseReplayResult> findByGoldenCaseId(
      Long goldenCaseId, DomainPageRequest pageRequest);
}
