package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.DecisionLog;
import com.init.workflowruntime.domain.DecisionLogRepository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaDecisionLogRepository
    extends JpaRepository<DecisionLog, Long>, DecisionLogRepository {

  @Query("select max(d.stepSeqNo) from DecisionLog d where d.workflowExecutionId = :execId")
  Optional<Integer> findMaxStepSeqNoByExecutionId(@Param("execId") Long executionId);
}
