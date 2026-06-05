package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
import com.init.workflowruntime.domain.SimulationGoldenCase;
import com.init.workflowruntime.domain.SimulationGoldenCaseRepository;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class SimulationGoldenCaseRepositoryAdapter implements SimulationGoldenCaseRepository {

  private final JpaSimulationGoldenCaseRepository jpaRepository;

  public SimulationGoldenCaseRepositoryAdapter(JpaSimulationGoldenCaseRepository jpaRepository) {
    this.jpaRepository = jpaRepository;
  }

  @Override
  public SimulationGoldenCase save(SimulationGoldenCase goldenCase) {
    return jpaRepository.save(goldenCase);
  }

  @Override
  public Optional<SimulationGoldenCase> findById(Long id) {
    return jpaRepository.findById(id);
  }

  @Override
  public Optional<SimulationGoldenCase> findByIdAndWorkspaceId(Long id, Long workspaceId) {
    return jpaRepository.findByIdAndWorkspaceId(id, workspaceId);
  }

  @Override
  public DomainPage<SimulationGoldenCase> findByWorkspaceId(
      Long workspaceId, DomainPageRequest pageRequest) {
    return toDomainPage(
        jpaRepository.findByWorkspaceIdOrderByCreatedAtDesc(
            workspaceId, PageRequest.of(pageRequest.page(), pageRequest.size())));
  }

  private DomainPage<SimulationGoldenCase> toDomainPage(Page<SimulationGoldenCase> page) {
    return new DomainPage<>(
        page.getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages());
  }
}
