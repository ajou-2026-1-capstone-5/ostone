package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.WorkspaceMemberRole;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UpdatePolicyStatusUseCase {

  private static final Set<WorkspaceMemberRole> ALLOWED_ROLES =
      Set.of(WorkspaceMemberRole.OPERATOR, WorkspaceMemberRole.ADMIN);

  private final PolicyDefinitionRepository policyRepository;
  private final DomainPackVersionRepository versionRepository;
  private final WorkspaceExistencePort workspaceExistencePort;
  private final WorkspaceMembershipPort workspaceMembershipPort;

  public UpdatePolicyStatusUseCase(
      PolicyDefinitionRepository policyRepository,
      DomainPackVersionRepository versionRepository,
      WorkspaceExistencePort workspaceExistencePort,
      WorkspaceMembershipPort workspaceMembershipPort) {
    this.policyRepository = policyRepository;
    this.versionRepository = versionRepository;
    this.workspaceExistencePort = workspaceExistencePort;
    this.workspaceMembershipPort = workspaceMembershipPort;
  }

  @Transactional
  public PolicyDefinitionResponse execute(UpdatePolicyStatusCommand command) {
    if (!workspaceExistencePort.existsById(command.workspaceId())) {
      throw new DomainPackWorkspaceNotFoundException(
          "워크스페이스를 찾을 수 없습니다. id=" + command.workspaceId());
    }

    if (!workspaceMembershipPort.hasAnyRole(
        command.workspaceId(), command.requesterId(), ALLOWED_ROLES)) {
      throw new DomainPackUnauthorizedWorkspaceAccessException(
          "워크스페이스에 접근 권한이 없습니다. workspaceId=" + command.workspaceId());
    }

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
      policy.changeStatus(command.status());
    } catch (IllegalArgumentException e) {
      throw new BadRequestException("VALIDATION_ERROR", e.getMessage());
    }

    policyRepository.save(policy);
    return PolicyDefinitionResponse.from(policy);
  }
}
