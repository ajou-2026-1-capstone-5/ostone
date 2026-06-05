package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayResult;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayResultRepository;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class SimulationGoldenCaseReplayResultRepositoryAdapter
    implements SimulationGoldenCaseReplayResultRepository {

  private final JpaSimulationGoldenCaseReplayResultRepository jpaRepository;

  public SimulationGoldenCaseReplayResultRepositoryAdapter(
      JpaSimulationGoldenCaseReplayResultRepository jpaRepository) {
    this.jpaRepository = jpaRepository;
  }

  @Override
  public SimulationGoldenCaseReplayResult save(SimulationGoldenCaseReplayResult replayResult) {
    return jpaRepository.save(replayResult);
  }

  @Override
  public Optional<SimulationGoldenCaseReplayResult> findLatestByGoldenCaseId(Long goldenCaseId) {
    return jpaRepository.findTopByGoldenCaseIdOrderByCreatedAtDescIdDesc(goldenCaseId);
  }

  @Override
  public DomainPage<SimulationGoldenCaseReplayResult> findByGoldenCaseId(
      Long goldenCaseId, DomainPageRequest pageRequest) {
    return toDomainPage(
        jpaRepository.findByGoldenCaseIdOrderByCreatedAtDesc(
            goldenCaseId, PageRequest.of(pageRequest.page(), pageRequest.size())));
  }

  private DomainPage<SimulationGoldenCaseReplayResult> toDomainPage(
      Page<SimulationGoldenCaseReplayResult> page) {
    return new DomainPage<>(
        page.getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages());
  }
}
