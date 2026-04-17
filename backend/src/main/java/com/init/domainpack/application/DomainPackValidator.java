package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.WorkspaceMemberRole;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class DomainPackValidator {

  private static final Set<WorkspaceMemberRole> ALLOWED_ROLES =
      Set.of(WorkspaceMemberRole.OPERATOR, WorkspaceMemberRole.ADMIN);

  private final WorkspaceExistencePort workspaceExistencePort;
  private final WorkspaceMembershipPort workspaceMembershipPort;
  private final DomainPackRepository domainPackRepository;
  private final DomainPackVersionRepository domainPackVersionRepository;

  public DomainPackValidator(
      WorkspaceExistencePort workspaceExistencePort,
      WorkspaceMembershipPort workspaceMembershipPort,
      DomainPackRepository domainPackRepository,
      DomainPackVersionRepository domainPackVersionRepository) {
    this.workspaceExistencePort = workspaceExistencePort;
    this.workspaceMembershipPort = workspaceMembershipPort;
    this.domainPackRepository = domainPackRepository;
    this.domainPackVersionRepository = domainPackVersionRepository;
  }

  public void validateWorkspaceAccess(Long workspaceId, Long userId) {
    if (!workspaceExistencePort.existsById(workspaceId)) {
      throw new DomainPackWorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다. id=" + workspaceId);
    }
    if (!workspaceMembershipPort.hasAnyRole(workspaceId, userId, ALLOWED_ROLES)) {
      throw new DomainPackUnauthorizedWorkspaceAccessException("워크스페이스에 접근 권한이 없습니다.");
    }
  }

  public void validateDomainPack(Long packId, Long workspaceId) {
    if (!domainPackRepository.existsByIdAndWorkspaceId(packId, workspaceId)) {
      throw new DomainPackNotFoundException(packId);
    }
  }

  public void validateVersion(Long versionId, Long packId) {
    DomainPackVersion version =
        domainPackVersionRepository
            .findById(versionId)
            .orElseThrow(() -> new DomainPackVersionNotFoundException(versionId));
    if (!version.getDomainPackId().equals(packId)) {
      throw new DomainPackVersionNotFoundException(versionId);
    }
  }

  public void validateForWorkspacePackVersion(
      Long workspaceId, Long userId, Long packId, Long versionId) {
    validateWorkspaceAccess(workspaceId, userId);
    validateDomainPack(packId, workspaceId);
    validateVersion(versionId, packId);
  }
}
