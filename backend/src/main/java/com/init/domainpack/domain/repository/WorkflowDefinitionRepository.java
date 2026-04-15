package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.WorkflowDefinition;
import java.util.List;
import java.util.Optional;

public interface WorkflowDefinitionRepository {

  <S extends WorkflowDefinition> List<S> saveAll(Iterable<S> entities);

  WorkflowDefinition save(WorkflowDefinition workflow);

  List<WorkflowDefinitionSummaryRow> findAllByDomainPackVersionId(Long domainPackVersionId);

  Optional<WorkflowDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);
}
