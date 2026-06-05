package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.WorkflowDefinition;
import java.util.List;
import java.util.Optional;

public interface WorkflowDefinitionRepository {

  <S extends WorkflowDefinition> List<S> saveAll(Iterable<S> entities);

  <S extends WorkflowDefinition> List<S> saveAllAndFlush(Iterable<S> entities);

  WorkflowDefinition save(WorkflowDefinition workflow);

  List<WorkflowDefinition> findAllByDomainPackVersionId(Long domainPackVersionId);

  List<WorkflowDefinitionSummaryRow> findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(
      Long domainPackVersionId);

  Optional<WorkflowDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);

  Optional<WorkflowDefinition> findByDomainPackVersionIdAndWorkflowCode(
      Long domainPackVersionId, String workflowCode);

  Optional<WorkflowDefinition> findByIdAndDomainPackVersionIdForUpdate(
      Long id, Long domainPackVersionId);

  List<WorkflowDefinition> findAllByIntentDefinitionIdAndDomainPackVersionId(
      Long intentDefinitionId, Long domainPackVersionId);

  boolean existsByDomainPackVersionIdAndPolicyRef(Long versionId, String policyCode);

  long countByDomainPackVersionId(Long domainPackVersionId);
}
