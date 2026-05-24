package com.init.workflowruntime.domain;

import java.util.Optional;

public interface DecisionLogRepository {

  DecisionLog save(DecisionLog decisionLog);

  Optional<Integer> findMaxStepSeqNoByExecutionId(Long executionId);
}
