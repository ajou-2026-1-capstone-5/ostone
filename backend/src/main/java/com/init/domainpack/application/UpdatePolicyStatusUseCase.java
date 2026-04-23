package com.init.domainpack.application;

import com.init.domainpack.application.exception.PolicyCodeReferencedByWorkflowException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UpdatePolicyStatusUseCase {

  private final DomainPackValidator validator;
  private final PolicyDefinitionRepository policyRepository;
  private final DomainPackVersionRepository versionRepository;
  private final WorkflowDefinitionRepository workflowRepository;

  public UpdatePolicyStatusUseCase(
      DomainPackValidator validator,
      PolicyDefinitionRepository policyRepository,
      DomainPackVersionRepository versionRepository,
      WorkflowDefinitionRepository workflowRepository) {
    this.validator = validator;
    this.policyRepository = policyRepository;
    this.versionRepository = versionRepository;
    this.workflowRepository = workflowRepository;
  }

  @Transactional
  public PolicyDefinitionResponse execute(UpdatePolicyStatusCommand command) {
    validator.validateWorkspaceAccess(command.workspaceId(), command.requesterId());
    validator.validateDomainPack(command.packId(), command.workspaceId());

    DomainPackVersion version =
        versionRepository
            .findById(command.versionId())
            .orElseThrow(
                () -> new NotFoundException("NOT_FOUND", "버전을 찾을 수 없습니다: " + command.versionId()));

    if (!version.getDomainPackId().equals(command.packId())) {
      throw new NotFoundException("NOT_FOUND", "버전을 찾을 수 없습니다: " + command.versionId());
    }

    if (!DomainPackVersion.STATUS_DRAFT.equals(version.getLifecycleStatus())) {
      throw new BadRequestException("POLICY_NOT_EDITABLE", "DRAFT 상태의 버전에서만 정책을 수정할 수 있습니다.");
    }

    PolicyDefinition policy =
        policyRepository
            .findById(command.policyId())
            .orElseThrow(
                () -> new NotFoundException("NOT_FOUND", "정책을 찾을 수 없습니다: " + command.policyId()));

    if (!policy.getDomainPackVersionId().equals(command.versionId())) {
      throw new NotFoundException("NOT_FOUND", "정책을 찾을 수 없습니다: " + command.policyId());
    }

    if (PolicyDefinition.STATUS_INACTIVE.equals(command.status())) {
      String policyCode = policy.getPolicyCode();
      if (workflowRepository.existsByDomainPackVersionIdAndPolicyRef(command.versionId(), policyCode)) {
        throw new PolicyCodeReferencedByWorkflowException(policyCode);
      }
    }

    try {
      policy.changeStatus(command.status());
    } catch (IllegalArgumentException e) {
      throw new BadRequestException("VALIDATION_ERROR", e.getMessage());
    }

    policyRepository.save(policy);
    return PolicyDefinitionResponse.from(policy);
  }
}
