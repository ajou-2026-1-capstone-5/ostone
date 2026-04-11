package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaWorkflowDefinitionRepository
    extends JpaRepository<WorkflowDefinition, Long>, WorkflowDefinitionRepository {

  List<WorkflowDefinition> findByDomainPackVersionId(Long domainPackVersionId);
}
