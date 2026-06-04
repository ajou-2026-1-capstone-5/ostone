package com.init.workflowruntime.domain;

import java.util.List;
import java.util.Optional;

public interface SimulationFeedbackRepository {

  SimulationFeedback save(SimulationFeedback feedback);

  Optional<SimulationFeedback> findById(Long id);

  Optional<SimulationFeedback> findByIdForUpdate(Long id);

  List<SimulationFeedback> findByChatSessionIdOrderByCreatedAtAsc(Long chatSessionId);

  DomainPage<SimulationFeedback> findByWorkspaceId(Long workspaceId, DomainPageRequest pageRequest);

  DomainPage<SimulationFeedback> findByWorkspaceIdAndStatus(
      Long workspaceId, SimulationFeedbackStatus status, DomainPageRequest pageRequest);
}
