package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.SimulationFeedback;
import com.init.workflowruntime.domain.SimulationFeedbackStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaSimulationFeedbackRepository extends JpaRepository<SimulationFeedback, Long> {

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select feedback from SimulationFeedback feedback where feedback.id = :id")
  Optional<SimulationFeedback> findByIdForUpdate(@Param("id") Long id);

  List<SimulationFeedback> findByChatSessionIdOrderByCreatedAtAsc(Long chatSessionId);

  Page<SimulationFeedback> findByWorkspaceIdOrderByCreatedAtDesc(
      Long workspaceId, Pageable pageable);

  Page<SimulationFeedback> findByWorkspaceIdAndStatusOrderByCreatedAtDesc(
      Long workspaceId, SimulationFeedbackStatus status, Pageable pageable);
}
