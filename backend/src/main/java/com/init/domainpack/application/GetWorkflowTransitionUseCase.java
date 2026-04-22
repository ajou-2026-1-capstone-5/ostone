package com.init.domainpack.application;

import com.init.domainpack.application.exception.WorkflowDefinitionNotFoundException;
import com.init.domainpack.application.exception.WorkflowTransitionNotFoundException;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetWorkflowTransitionUseCase {

  private final DomainPackValidator validator;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;

  public GetWorkflowTransitionUseCase(
      DomainPackValidator validator,
      WorkflowDefinitionRepository workflowDefinitionRepository) {
    this.validator = validator;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
  }

  public WorkflowTransitionDetail execute(GetWorkflowTransitionQuery query) {
    validator.validateWorkspaceAccess(query.workspaceId(), query.userId());
    validator.validateDomainPack(query.packId(), query.workspaceId());
    validator.validateVersion(query.versionId(), query.packId());

    var workflow =
        workflowDefinitionRepository
            .findByIdAndDomainPackVersionId(query.workflowId(), query.versionId())
            .orElseThrow(() -> new WorkflowDefinitionNotFoundException(query.workflowId()));

    return WorkflowTransitionDetail.fromGraphJson(
            workflow.getGraphJson(),
            query.transitionId(),
            workflow.getId(),
            workflow.getDomainPackVersionId())
        .orElseThrow(() -> new WorkflowTransitionNotFoundException(query.transitionId()));
  }
}
