package com.init.domainpack.application;

import com.init.domainpack.application.exception.WorkflowDefinitionNotFoundException;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetWorkflowDefinitionUseCase {

  private final DomainPackValidator validator;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;

  public GetWorkflowDefinitionUseCase(
      DomainPackValidator validator, WorkflowDefinitionRepository workflowDefinitionRepository) {
    this.validator = validator;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
  }

  public WorkflowDefinitionDetail execute(GetWorkflowDefinitionQuery query) {
    validator.validateWorkspaceAccess(query.workspaceId(), query.userId());
    validator.validateDomainPack(query.packId(), query.workspaceId());
    validator.validateVersion(query.versionId(), query.packId());

    return workflowDefinitionRepository
        .findByIdAndDomainPackVersionId(query.workflowId(), query.versionId())
        .map(WorkflowDefinitionDetail::from)
        .orElseThrow(() -> new WorkflowDefinitionNotFoundException(query.workflowId()));
  }
}
