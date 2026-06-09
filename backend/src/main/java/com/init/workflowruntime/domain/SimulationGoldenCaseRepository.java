package com.init.workflowruntime.domain;

import java.util.Optional;

public interface SimulationGoldenCaseRepository {

  SimulationGoldenCase save(SimulationGoldenCase goldenCase);

  Optional<SimulationGoldenCase> findById(Long id);

  Optional<SimulationGoldenCase> findByIdAndWorkspaceId(Long id, Long workspaceId);

  Optional<SimulationGoldenCase> findBySourceChatSessionId(Long sourceChatSessionId);

  DomainPage<SimulationGoldenCase> findByWorkspaceId(
      Long workspaceId, DomainPageRequest pageRequest);
}
