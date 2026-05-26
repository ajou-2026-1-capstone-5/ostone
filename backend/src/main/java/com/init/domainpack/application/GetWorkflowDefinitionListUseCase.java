package com.init.domainpack.application;

import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetWorkflowDefinitionListUseCase {

  private final DomainPackValidator validator;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;

  public GetWorkflowDefinitionListUseCase(
      DomainPackValidator validator, WorkflowDefinitionRepository workflowDefinitionRepository) {
    this.validator = validator;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
  }

  public List<WorkflowDefinitionSummary> execute(GetWorkflowDefinitionListQuery query) {
    validator.validateWorkspaceAccess(query.workspaceId(), query.userId());
    validator.validateDomainPack(query.packId(), query.workspaceId());
    validator.validateVersion(query.versionId(), query.packId());

    Long intentId = query.intentDefinitionId();
    return workflowDefinitionRepository
        .findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(query.versionId())
        .stream()
        .filter(row -> intentId == null || Objects.equals(row.getIntentDefinitionId(), intentId))
        .map(WorkflowDefinitionSummary::from)
        .toList();
  }
}
