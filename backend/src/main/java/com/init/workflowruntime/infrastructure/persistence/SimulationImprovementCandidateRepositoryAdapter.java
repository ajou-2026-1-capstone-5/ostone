package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
import com.init.workflowruntime.domain.SimulationImprovementCandidate;
import com.init.workflowruntime.domain.SimulationImprovementCandidateRepository;
import com.init.workflowruntime.domain.SimulationImprovementCandidateStatus;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class SimulationImprovementCandidateRepositoryAdapter
    implements SimulationImprovementCandidateRepository {

  private final JpaSimulationImprovementCandidateRepository jpaRepository;

  public SimulationImprovementCandidateRepositoryAdapter(
      JpaSimulationImprovementCandidateRepository jpaRepository) {
    this.jpaRepository = jpaRepository;
  }

  @Override
  public SimulationImprovementCandidate save(SimulationImprovementCandidate candidate) {
    return jpaRepository.save(candidate);
  }

  @Override
  public Optional<SimulationImprovementCandidate> findById(Long id) {
    return jpaRepository.findById(id);
  }

  @Override
  public Optional<SimulationImprovementCandidate> findByFeedbackId(Long feedbackId) {
    return jpaRepository.findByFeedbackId(feedbackId);
  }

  @Override
  public DomainPage<SimulationImprovementCandidate> findByWorkspaceId(
      Long workspaceId, DomainPageRequest pageRequest) {
    return toDomainPage(
        jpaRepository.findByWorkspaceIdOrderByCreatedAtDesc(
            workspaceId, PageRequest.of(pageRequest.page(), pageRequest.size())));
  }

  @Override
  public DomainPage<SimulationImprovementCandidate> findByWorkspaceIdAndStatus(
      Long workspaceId,
      SimulationImprovementCandidateStatus status,
      DomainPageRequest pageRequest) {
    return toDomainPage(
        jpaRepository.findByWorkspaceIdAndStatusOrderByCreatedAtDesc(
            workspaceId, status, PageRequest.of(pageRequest.page(), pageRequest.size())));
  }

  private DomainPage<SimulationImprovementCandidate> toDomainPage(
      Page<SimulationImprovementCandidate> page) {
    return new DomainPage<>(
        page.getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages());
  }
}
