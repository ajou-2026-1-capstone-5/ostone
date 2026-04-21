package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionSummaryRow;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaWorkflowDefinitionRepository
    extends JpaRepository<WorkflowDefinition, Long>, WorkflowDefinitionRepository {

  @Override
  List<WorkflowDefinitionSummaryRow> findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(
      Long domainPackVersionId);

  @Override
  Optional<WorkflowDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);
}
