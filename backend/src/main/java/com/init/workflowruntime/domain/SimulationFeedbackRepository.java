package com.init.workflowruntime.domain;

import java.util.List;

public interface SimulationFeedbackRepository {

  SimulationFeedback save(SimulationFeedback feedback);

  List<SimulationFeedback> findByChatSessionIdOrderByCreatedAtAsc(Long chatSessionId);

  DomainPage<SimulationFeedback> findByWorkspaceId(Long workspaceId, DomainPageRequest pageRequest);

  DomainPage<SimulationFeedback> findByWorkspaceIdAndStatus(
      Long workspaceId, SimulationFeedbackStatus status, DomainPageRequest pageRequest);
}
