package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.SimulationFeedback;
import com.init.workflowruntime.domain.SimulationFeedbackStatus;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaSimulationFeedbackRepository extends JpaRepository<SimulationFeedback, Long> {

  List<SimulationFeedback> findByChatSessionIdOrderByCreatedAtAsc(Long chatSessionId);

  Page<SimulationFeedback> findByWorkspaceIdOrderByCreatedAtDesc(
      Long workspaceId, Pageable pageable);

  Page<SimulationFeedback> findByWorkspaceIdAndStatusOrderByCreatedAtDesc(
      Long workspaceId, SimulationFeedbackStatus status, Pageable pageable);
}
