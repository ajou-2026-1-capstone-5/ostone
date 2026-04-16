package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UpdatePolicyUseCase {

  private final DomainPackValidator validator;
  private final PolicyDefinitionRepository policyRepository;
  private final DomainPackVersionRepository versionRepository;

  public UpdatePolicyUseCase(
      DomainPackValidator validator,
      PolicyDefinitionRepository policyRepository,
      DomainPackVersionRepository versionRepository) {
    this.validator = validator;
    this.policyRepository = policyRepository;
    this.versionRepository = versionRepository;
  }

  @Transactional
  public PolicyDefinitionResponse execute(UpdatePolicyCommand command) {
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

    try {
      policy.updateFields(
          command.name(),
          command.description(),
          command.severity(),
          command.conditionJson(),
          command.actionJson(),
          command.evidenceJson(),
          command.metaJson());
    } catch (IllegalArgumentException e) {
      throw new BadRequestException("VALIDATION_ERROR", e.getMessage());
    }

    policyRepository.save(policy);
    return PolicyDefinitionResponse.from(policy);
  }
}
