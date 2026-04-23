package com.init.domainpack.application;

import com.init.domainpack.application.exception.WorkflowDefinitionNotFoundException;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetWorkflowTransitionListUseCase {

  private final DomainPackValidator validator;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;

  public GetWorkflowTransitionListUseCase(
      DomainPackValidator validator, WorkflowDefinitionRepository workflowDefinitionRepository) {
    this.validator = validator;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
  }

  public List<WorkflowTransitionDetail> execute(GetWorkflowTransitionListQuery query) {
    validator.validateWorkspaceAccess(query.workspaceId(), query.userId());
    validator.validateDomainPack(query.packId(), query.workspaceId());
    validator.validateVersion(query.versionId(), query.packId());

    var workflow =
        workflowDefinitionRepository
            .findByIdAndDomainPackVersionId(query.workflowId(), query.versionId())
            .orElseThrow(() -> new WorkflowDefinitionNotFoundException(query.workflowId()));

    return WorkflowTransitionDetail.listFromGraphJson(
        workflow.getGraphJson(), workflow.getId(), workflow.getDomainPackVersionId());
  }
}
