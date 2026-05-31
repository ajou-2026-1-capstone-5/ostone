package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionConflictException;
import com.init.domainpack.application.exception.DomainPackVersionInvalidStateException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.WorkspaceMemberRole;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import com.init.shared.application.exception.BadRequestException;
import com.init.workflowruntime.application.matching.WorkflowMatchingProfileBuildRequestService;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Set;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DeployDomainPackVersionUseCase {

  private static final Set<WorkspaceMemberRole> ALLOWED_WORKSPACE_ROLES =
      Set.of(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.OPERATOR, WorkspaceMemberRole.ADMIN);

  private final DomainPackVersionRepository versionRepository;
  private final DomainPackRepository domainPackRepository;
  private final IntentDefinitionRepository intentDefinitionRepository;
  private final WorkspaceExistencePort workspaceExistencePort;
  private final WorkspaceMembershipPort workspaceMembershipPort;
  private final Clock clock;
  private final WorkflowMatchingProfileBuildRequestService profileBuildRequestService;

  public DeployDomainPackVersionUseCase(
      DomainPackVersionRepository versionRepository,
      DomainPackRepository domainPackRepository,
      IntentDefinitionRepository intentDefinitionRepository,
      WorkspaceExistencePort workspaceExistencePort,
      WorkspaceMembershipPort workspaceMembershipPort,
      Clock clock,
      WorkflowMatchingProfileBuildRequestService profileBuildRequestService) {
    this.versionRepository = versionRepository;
    this.domainPackRepository = domainPackRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.workspaceExistencePort = workspaceExistencePort;
    this.workspaceMembershipPort = workspaceMembershipPort;
    this.clock = clock;
    this.profileBuildRequestService = profileBuildRequestService;
  }

  @Transactional
  public DeployDomainPackVersionResult execute(DeployDomainPackVersionCommand command) {
    if (!workspaceExistencePort.existsById(command.workspaceId())) {
      throw new DomainPackWorkspaceNotFoundException(
          "워크스페이스를 찾을 수 없습니다. id=" + command.workspaceId());
    }

    if (!workspaceMembershipPort.hasAnyRole(
        command.workspaceId(), command.userId(), ALLOWED_WORKSPACE_ROLES)) {
      throw new DomainPackUnauthorizedWorkspaceAccessException(
          "워크스페이스에 접근 권한이 없습니다. workspaceId=" + command.workspaceId());
    }

    domainPackRepository
        .findByIdAndWorkspaceIdForUpdate(command.packId(), command.workspaceId())
        .orElseThrow(() -> new DomainPackNotFoundException(command.packId()));

    DomainPackVersion version =
        versionRepository
            .findByIdAndWorkspaceId(command.workspaceId(), command.versionId())
            .orElseThrow(() -> new DomainPackVersionNotFoundException(command.versionId()));

    if (!version.getDomainPackId().equals(command.packId())) {
      throw new DomainPackVersionNotFoundException(command.versionId());
    }

    if (!DomainPackVersion.STATUS_PUBLISHED.equals(version.getLifecycleStatus())) {
      throw new DomainPackVersionInvalidStateException("PUBLISHED 상태의 version만 배포할 수 있습니다.");
    }

    long draftIntentCount =
        intentDefinitionRepository.countByDomainPackVersionIdAndStatus(
            version.getId(), IntentDefinition.STATUS_DRAFT);
    if (draftIntentCount > 0) {
      throw new BadRequestException(
          "DOMAIN_PACK_VERSION_NOT_DEPLOYABLE",
          "DRAFT 상태의 Intent가 " + draftIntentCount + "개 남아 있어 Domain Pack Version을 배포할 수 없습니다.");
    }

    try {
      version.markDeployed(OffsetDateTime.now(clock));
      DomainPackVersion saved = versionRepository.saveAndFlush(version);
      profileBuildRequestService.enqueue(saved.getId(), "VERSION_DEPLOYED");
      return DeployDomainPackVersionResult.from(saved);
    } catch (ObjectOptimisticLockingFailureException e) {
      throw new DomainPackVersionConflictException(command.versionId(), e);
    }
  }
}
