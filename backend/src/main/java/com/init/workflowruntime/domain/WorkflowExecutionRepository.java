package com.init.workflowruntime.domain;

import java.util.Optional;

public interface WorkflowExecutionRepository {

  Optional<WorkflowExecution> findTopByChatSessionIdOrderByStartedAtDescIdDesc(Long chatSessionId);

  Optional<WorkflowExecution> findLatestByChatSessionIdForUpdate(Long chatSessionId);

  WorkflowExecution save(WorkflowExecution execution);
}
