package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionConflictException;
import com.init.domainpack.application.exception.DomainPackVersionInvalidStateException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.WorkspaceMemberRole;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ActivateDomainPackVersionUseCase {

  private static final Set<WorkspaceMemberRole> ALLOWED_WORKSPACE_ROLES =
      Set.of(WorkspaceMemberRole.OPERATOR, WorkspaceMemberRole.ADMIN);

  private final DomainPackVersionRepository versionRepository;
  private final WorkspaceExistencePort workspaceExistencePort;
  private final WorkspaceMembershipPort workspaceMembershipPort;
  private final Clock clock;

  @Autowired
  public ActivateDomainPackVersionUseCase(
      DomainPackVersionRepository versionRepository,
      WorkspaceExistencePort workspaceExistencePort,
      WorkspaceMembershipPort workspaceMembershipPort) {
    this(
        versionRepository,
        workspaceExistencePort,
        workspaceMembershipPort,
        Clock.systemDefaultZone());
  }

  public ActivateDomainPackVersionUseCase(
      DomainPackVersionRepository versionRepository,
      WorkspaceExistencePort workspaceExistencePort,
      WorkspaceMembershipPort workspaceMembershipPort,
      Clock clock) {
    this.versionRepository = versionRepository;
    this.workspaceExistencePort = workspaceExistencePort;
    this.workspaceMembershipPort = workspaceMembershipPort;
    this.clock = clock;
  }

  @Transactional
  public ActivateDomainPackVersionResult execute(ActivateDomainPackVersionCommand command) {
    // workspace 존재 확인 (U-005 Confirmed)
    if (!workspaceExistencePort.existsById(command.workspaceId())) {
      throw new DomainPackWorkspaceNotFoundException(
          "워크스페이스를 찾을 수 없습니다. id=" + command.workspaceId());
    }

    // workspace 멤버십 + 역할 확인: OPERATOR 또는 ADMIN만 허용 (U-005 Confirmed)
    if (!workspaceMembershipPort.hasAnyRole(
        command.workspaceId(), command.userId(), ALLOWED_WORKSPACE_ROLES)) {
      throw new DomainPackUnauthorizedWorkspaceAccessException(
          "워크스페이스에 접근 권한이 없습니다. workspaceId=" + command.workspaceId());
    }

    DomainPackVersion version =
        versionRepository
            .findByIdAndWorkspaceId(command.workspaceId(), command.versionId())
            .orElseThrow(() -> new DomainPackVersionNotFoundException(command.versionId()));

    // packId 일치 검증 (path variable 위·변조 방어)
    if (!version.getDomainPackId().equals(command.packId())) {
      throw new DomainPackVersionNotFoundException(command.versionId());
    }

    // lifecycle_status 전이: PUBLISHED가 아닌 모든 상태에서 허용 (U-001 Confirmed)
    try {
      version.activate(OffsetDateTime.now(clock));
    } catch (IllegalStateException e) {
      throw new DomainPackVersionInvalidStateException(e.getMessage());
    }

    // review_decision 검증 없음 (U-002 Confirmed)
    // 기존 PUBLISHED 버전 비활성화 없음 (U-003 Confirmed)
    // Domain Event 발행 없음 (U-004 Confirmed)
    try {
      DomainPackVersion saved = versionRepository.saveAndFlush(version);
      return ActivateDomainPackVersionResult.from(saved);
    } catch (ObjectOptimisticLockingFailureException e) {
      throw new DomainPackVersionConflictException(command.versionId());
    }
  }
}
