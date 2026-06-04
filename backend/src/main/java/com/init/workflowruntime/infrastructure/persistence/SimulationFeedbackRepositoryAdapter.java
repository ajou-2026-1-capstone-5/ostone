package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
import com.init.workflowruntime.domain.SimulationFeedback;
import com.init.workflowruntime.domain.SimulationFeedbackRepository;
import com.init.workflowruntime.domain.SimulationFeedbackStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class SimulationFeedbackRepositoryAdapter implements SimulationFeedbackRepository {

  private final JpaSimulationFeedbackRepository jpaRepository;

  public SimulationFeedbackRepositoryAdapter(JpaSimulationFeedbackRepository jpaRepository) {
    this.jpaRepository = jpaRepository;
  }

  @Override
  public SimulationFeedback save(SimulationFeedback feedback) {
    return jpaRepository.save(feedback);
  }

  @Override
  public Optional<SimulationFeedback> findById(Long id) {
    return jpaRepository.findById(id);
  }

  @Override
  public Optional<SimulationFeedback> findByIdForUpdate(Long id) {
    return jpaRepository.findByIdForUpdate(id);
  }

  @Override
  public List<SimulationFeedback> findByChatSessionIdOrderByCreatedAtAsc(Long chatSessionId) {
    return jpaRepository.findByChatSessionIdOrderByCreatedAtAsc(chatSessionId);
  }

  @Override
  public DomainPage<SimulationFeedback> findByWorkspaceId(
      Long workspaceId, DomainPageRequest pageRequest) {
    return toDomainPage(
        jpaRepository.findByWorkspaceIdOrderByCreatedAtDesc(
            workspaceId, PageRequest.of(pageRequest.page(), pageRequest.size())));
  }

  @Override
  public DomainPage<SimulationFeedback> findByWorkspaceIdAndStatus(
      Long workspaceId, SimulationFeedbackStatus status, DomainPageRequest pageRequest) {
    return toDomainPage(
        jpaRepository.findByWorkspaceIdAndStatusOrderByCreatedAtDesc(
            workspaceId, status, PageRequest.of(pageRequest.page(), pageRequest.size())));
  }

  private DomainPage<SimulationFeedback> toDomainPage(Page<SimulationFeedback> page) {
    return new DomainPage<>(
        page.getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages());
  }
}
