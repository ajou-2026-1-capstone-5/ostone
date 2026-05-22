package com.init.workflowruntime.domain;

import java.util.Optional;

public interface WorkflowExecutionRepository {

  Optional<WorkflowExecution> findTopByChatSessionIdOrderByStartedAtDesc(Long chatSessionId);

  WorkflowExecution save(WorkflowExecution execution);
}
