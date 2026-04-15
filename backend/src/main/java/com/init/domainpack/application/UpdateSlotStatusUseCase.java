package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkspaceMemberRole;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UpdateSlotStatusUseCase {

  private static final Set<WorkspaceMemberRole> ALLOWED_ROLES =
      Set.of(WorkspaceMemberRole.OPERATOR, WorkspaceMemberRole.ADMIN);

  private final SlotDefinitionRepository slotRepository;
  private final DomainPackVersionRepository versionRepository;
  private final WorkspaceExistencePort workspaceExistencePort;
  private final WorkspaceMembershipPort workspaceMembershipPort;

  public UpdateSlotStatusUseCase(
      SlotDefinitionRepository slotRepository,
      DomainPackVersionRepository versionRepository,
      WorkspaceExistencePort workspaceExistencePort,
      WorkspaceMembershipPort workspaceMembershipPort) {
    this.slotRepository = slotRepository;
    this.versionRepository = versionRepository;
    this.workspaceExistencePort = workspaceExistencePort;
    this.workspaceMembershipPort = workspaceMembershipPort;
  }

  @Transactional
  public SlotDefinitionResponse execute(UpdateSlotStatusCommand command) {
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
      throw new BadRequestException("SLOT_NOT_EDITABLE", "DRAFT 상태의 버전에서만 슬롯을 수정할 수 있습니다.");
    }

    SlotDefinition slot =
        slotRepository
            .findById(command.slotId())
            .orElseThrow(
                () -> new NotFoundException("NOT_FOUND", "슬롯을 찾을 수 없습니다: " + command.slotId()));

    if (!slot.getDomainPackVersionId().equals(command.versionId())) {
      throw new NotFoundException("NOT_FOUND", "슬롯을 찾을 수 없습니다: " + command.slotId());
    }

    try {
      slot.changeStatus(command.status());
    } catch (IllegalArgumentException e) {
      throw new BadRequestException("VALIDATION_ERROR", e.getMessage());
    }

    slotRepository.save(slot);
    return SlotDefinitionResponse.from(slot);
  }
}
