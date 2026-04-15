package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.WorkspaceMemberRole;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class CreateDomainPackDraftUseCase {

  private static final Set<WorkspaceMemberRole> ALLOWED_WORKSPACE_ROLES =
      Set.of(WorkspaceMemberRole.OPERATOR, WorkspaceMemberRole.ADMIN);

  private final DomainPackRepository domainPackRepository;
  private final WorkspaceExistencePort workspaceExistencePort;
  private final WorkspaceMembershipPort workspaceMembershipPort;
  private final DomainPackDraftPersistenceService domainPackDraftPersistenceService;

  public CreateDomainPackDraftUseCase(
      DomainPackRepository domainPackRepository,
      WorkspaceExistencePort workspaceExistencePort,
      WorkspaceMembershipPort workspaceMembershipPort,
      DomainPackDraftPersistenceService domainPackDraftPersistenceService) {
    this.domainPackRepository = domainPackRepository;
    this.workspaceExistencePort = workspaceExistencePort;
    this.workspaceMembershipPort = workspaceMembershipPort;
    this.domainPackDraftPersistenceService = domainPackDraftPersistenceService;
  }

  public CreateDomainPackDraftResult execute(CreateDomainPackDraftCommand command) {
    validateWorkspaceAccess(command);
    validateDomainPack(command);
    return domainPackDraftPersistenceService.persist(
        command.packId(),
        command.userId(),
        command.sourcePipelineJobId(),
        command.summaryJson(),
        command.intents(),
        command.slots(),
        command.intentSlotBindings(),
        command.policies(),
        command.risks(),
        command.workflows(),
        command.intentWorkflowBindings());
  }

  private void validateWorkspaceAccess(CreateDomainPackDraftCommand command) {
    if (!workspaceExistencePort.existsById(command.workspaceId())) {
      throw new DomainPackWorkspaceNotFoundException(
          "워크스페이스를 찾을 수 없습니다. id=" + command.workspaceId());
    }

    if (!workspaceMembershipPort.hasAnyRole(
        command.workspaceId(), command.userId(), ALLOWED_WORKSPACE_ROLES)) {
      throw new DomainPackUnauthorizedWorkspaceAccessException(
          "워크스페이스에 접근 권한이 없습니다. workspaceId=" + command.workspaceId());
    }
  }

  private void validateDomainPack(CreateDomainPackDraftCommand command) {
    if (!domainPackRepository.existsByIdAndWorkspaceId(command.packId(), command.workspaceId())) {
      throw new DomainPackNotFoundException(command.packId());
    }
  }
}
