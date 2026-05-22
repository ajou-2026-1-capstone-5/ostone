package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaWorkflowExecutionRepository
    extends JpaRepository<WorkflowExecution, Long>, WorkflowExecutionRepository {

  @Override
  default Optional<WorkflowExecution> findLatestByChatSessionIdForUpdate(Long chatSessionId) {
    return findAllByChatSessionIdForUpdate(chatSessionId, PageRequest.of(0, 1)).stream()
        .findFirst();
  }

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      """
      select execution
      from WorkflowExecution execution
      where execution.chatSessionId = :chatSessionId
      order by execution.startedAt desc
      """)
  List<WorkflowExecution> findAllByChatSessionIdForUpdate(
      @Param("chatSessionId") Long chatSessionId, Pageable pageable);
}
