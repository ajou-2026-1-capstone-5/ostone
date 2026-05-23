package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionConflictException;
import com.init.domainpack.application.exception.DomainPackVersionInvalidStateException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPack;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import com.init.shared.application.exception.BadRequestException;
import java.lang.reflect.Constructor;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("DeployDomainPackVersionUseCase")
class DeployDomainPackVersionUseCaseTest {

  private static final Instant FIXED_INSTANT = Instant.parse("2026-04-09T12:00:00Z");
  private static final Clock FIXED_CLOCK = Clock.fixed(FIXED_INSTANT, ZoneOffset.UTC);

  @Mock private DomainPackVersionRepository versionRepository;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;
  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;

  private DeployDomainPackVersionUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new DeployDomainPackVersionUseCase(
            versionRepository,
            domainPackRepository,
            intentDefinitionRepository,
            workspaceExistencePort,
            workspaceMembershipPort,
            FIXED_CLOCK);
  }

  @Test
  @DisplayName("PUBLISHED version이고 DRAFT intent가 없으면 배포중으로 선택한다")
  void should_deploy_when_publishedVersionHasNoDraftIntent() {
    givenAccess();
    givenPackLock();
    DomainPackVersion version = createPublishedVersion(42L, 7L);
    given(versionRepository.findByIdAndWorkspaceId(1L, 42L)).willReturn(Optional.of(version));
    given(
            intentDefinitionRepository.countByDomainPackVersionIdAndStatus(
                42L, IntentDefinition.STATUS_DRAFT))
        .willReturn(0L);
    given(versionRepository.saveAndFlush(version)).willReturn(version);

    DeployDomainPackVersionResult result =
        useCase.execute(new DeployDomainPackVersionCommand(1L, 7L, 42L, 10L));

    assertThat(result.id()).isEqualTo(42L);
    assertThat(result.lifecycleStatus()).isEqualTo(DomainPackVersion.STATUS_PUBLISHED);
    assertThat(result.publishedAt()).isEqualTo(OffsetDateTime.now(FIXED_CLOCK));
  }

  @Test
  @DisplayName("DRAFT version은 배포할 수 없다")
  void should_throwInvalidState_when_versionIsDraft() {
    givenAccess();
    givenPackLock();
    DomainPackVersion version = createDraftVersion(42L, 7L);
    given(versionRepository.findByIdAndWorkspaceId(1L, 42L)).willReturn(Optional.of(version));

    assertThatThrownBy(() -> useCase.execute(new DeployDomainPackVersionCommand(1L, 7L, 42L, 10L)))
        .isInstanceOf(DomainPackVersionInvalidStateException.class);

    verify(versionRepository, never()).saveAndFlush(any());
  }

  @Test
  @DisplayName("DRAFT intent가 남은 PUBLISHED version은 배포할 수 없다")
  void should_throwNotDeployable_when_publishedVersionHasDraftIntent() {
    givenAccess();
    givenPackLock();
    DomainPackVersion version = createPublishedVersion(42L, 7L);
    given(versionRepository.findByIdAndWorkspaceId(1L, 42L)).willReturn(Optional.of(version));
    given(
            intentDefinitionRepository.countByDomainPackVersionIdAndStatus(
                42L, IntentDefinition.STATUS_DRAFT))
        .willReturn(2L);

    assertThatThrownBy(() -> useCase.execute(new DeployDomainPackVersionCommand(1L, 7L, 42L, 10L)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("DRAFT");

    verify(versionRepository, never()).saveAndFlush(any());
  }

  @Test
  @DisplayName("workspace 없음 → DomainPackWorkspaceNotFoundException")
  void should_throwWorkspaceNotFound_when_workspaceMissing() {
    given(workspaceExistencePort.existsById(1L)).willReturn(false);

    assertThatThrownBy(() -> useCase.execute(new DeployDomainPackVersionCommand(1L, 7L, 42L, 10L)))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);

    verify(versionRepository, never()).findById(any());
  }

  @Test
  @DisplayName("workspace 비멤버 → DomainPackUnauthorizedWorkspaceAccessException")
  void should_throwUnauthorized_when_notMember() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(false);

    assertThatThrownBy(() -> useCase.execute(new DeployDomainPackVersionCommand(1L, 7L, 42L, 10L)))
        .isInstanceOf(DomainPackUnauthorizedWorkspaceAccessException.class);

    verify(versionRepository, never()).findById(any());
  }

  @Test
  @DisplayName("versionId 미존재 → DomainPackVersionNotFoundException")
  void should_throwVersionNotFound_when_versionMissing() {
    givenAccess();
    givenPackLock();
    given(versionRepository.findByIdAndWorkspaceId(1L, 42L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> useCase.execute(new DeployDomainPackVersionCommand(1L, 7L, 42L, 10L)))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }

  @Test
  @DisplayName("packId 불일치 → DomainPackVersionNotFoundException")
  void should_throwVersionNotFound_when_packMismatch() {
    givenAccess();
    givenPackLock();
    DomainPackVersion version = createPublishedVersion(42L, 99L);
    given(versionRepository.findByIdAndWorkspaceId(1L, 42L)).willReturn(Optional.of(version));

    assertThatThrownBy(() -> useCase.execute(new DeployDomainPackVersionCommand(1L, 7L, 42L, 10L)))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }

  @Test
  @DisplayName("동시 배포 충돌 → DomainPackVersionConflictException")
  void should_throwConflict_when_optimisticLockFails() {
    givenAccess();
    givenPackLock();
    DomainPackVersion version = createPublishedVersion(42L, 7L);
    given(versionRepository.findByIdAndWorkspaceId(1L, 42L)).willReturn(Optional.of(version));
    given(
            intentDefinitionRepository.countByDomainPackVersionIdAndStatus(
                42L, IntentDefinition.STATUS_DRAFT))
        .willReturn(0L);
    given(versionRepository.saveAndFlush(any()))
        .willThrow(new ObjectOptimisticLockingFailureException(DomainPackVersion.class, 42L));

    assertThatThrownBy(() -> useCase.execute(new DeployDomainPackVersionCommand(1L, 7L, 42L, 10L)))
        .isInstanceOf(DomainPackVersionConflictException.class);
  }

  private void givenAccess() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
  }

  private void givenPackLock() {
    given(domainPackRepository.findByIdAndWorkspaceIdForUpdate(7L, 1L))
        .willReturn(Optional.of(DomainPack.create(1L, "cs", "CS", null, 10L)));
  }

  private DomainPackVersion createDraftVersion(Long id, Long domainPackId) {
    DomainPackVersion version = newVersion();
    ReflectionTestUtils.setField(version, "id", id);
    ReflectionTestUtils.setField(version, "domainPackId", domainPackId);
    ReflectionTestUtils.setField(version, "versionNo", 1);
    ReflectionTestUtils.setField(version, "lifecycleStatus", DomainPackVersion.STATUS_DRAFT);
    ReflectionTestUtils.setField(version, "updatedAt", OffsetDateTime.now(FIXED_CLOCK));
    return version;
  }

  private DomainPackVersion createPublishedVersion(Long id, Long domainPackId) {
    DomainPackVersion version = newVersion();
    ReflectionTestUtils.setField(version, "id", id);
    ReflectionTestUtils.setField(version, "domainPackId", domainPackId);
    ReflectionTestUtils.setField(version, "versionNo", 1);
    ReflectionTestUtils.setField(version, "lifecycleStatus", DomainPackVersion.STATUS_PUBLISHED);
    ReflectionTestUtils.setField(
        version, "publishedAt", OffsetDateTime.parse("2026-04-08T12:00:00Z"));
    ReflectionTestUtils.setField(
        version, "updatedAt", OffsetDateTime.parse("2026-04-08T12:00:00Z"));
    return version;
  }

  private DomainPackVersion newVersion() {
    try {
      Constructor<DomainPackVersion> ctor = DomainPackVersion.class.getDeclaredConstructor();
      ctor.setAccessible(true);
      return ctor.newInstance();
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }
}
