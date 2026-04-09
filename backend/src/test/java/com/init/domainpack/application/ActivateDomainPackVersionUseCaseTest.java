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
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
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
@DisplayName("ActivateDomainPackVersionUseCase")
class ActivateDomainPackVersionUseCaseTest {

  private static final Instant FIXED_INSTANT = Instant.parse("2026-04-09T12:00:00Z");
  private static final Clock FIXED_CLOCK = Clock.fixed(FIXED_INSTANT, ZoneOffset.UTC);

  @Mock private DomainPackVersionRepository versionRepository;
  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;

  private ActivateDomainPackVersionUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new ActivateDomainPackVersionUseCase(
            versionRepository, workspaceExistencePort, workspaceMembershipPort, FIXED_CLOCK);
  }

  @Test
  @DisplayName("정상 활성화: DRAFT → PUBLISHED, 결과 반환")
  void execute_validDraft_returnsPublishedResult() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);

    DomainPackVersion version = createDraftVersion(42L, 7L);
    given(versionRepository.findById(42L)).willReturn(Optional.of(version));

    DomainPackVersion saved = createSavedVersion(42L, 7L);
    given(versionRepository.save(any())).willReturn(saved);

    ActivateDomainPackVersionCommand command =
        new ActivateDomainPackVersionCommand(1L, 7L, 42L, 10L);
    ActivateDomainPackVersionResult result = useCase.execute(command);

    assertThat(result.id()).isEqualTo(42L);
    assertThat(result.lifecycleStatus()).isEqualTo("PUBLISHED");
    assertThat(result.publishedAt()).isNotNull();
  }

  @Test
  @DisplayName("workspace 없음 → DomainPackWorkspaceNotFoundException")
  void execute_workspaceNotFound_throws404() {
    given(workspaceExistencePort.existsById(1L)).willReturn(false);

    assertThatThrownBy(
            () -> useCase.execute(new ActivateDomainPackVersionCommand(1L, 7L, 42L, 10L)))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);

    verify(versionRepository, never()).findById(any());
  }

  @Test
  @DisplayName("workspace 비멤버 → DomainPackUnauthorizedWorkspaceAccessException")
  void execute_notMember_throws403() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(false);

    assertThatThrownBy(
            () -> useCase.execute(new ActivateDomainPackVersionCommand(1L, 7L, 42L, 10L)))
        .isInstanceOf(DomainPackUnauthorizedWorkspaceAccessException.class);

    verify(versionRepository, never()).findById(any());
  }

  @Test
  @DisplayName("존재하지 않는 versionId → DomainPackVersionNotFoundException")
  void execute_versionNotFound_throws404() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(42L)).willReturn(Optional.empty());

    assertThatThrownBy(
            () -> useCase.execute(new ActivateDomainPackVersionCommand(1L, 7L, 42L, 10L)))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }

  @Test
  @DisplayName("packId 불일치 → DomainPackVersionNotFoundException")
  void execute_packIdMismatch_throws404() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);

    DomainPackVersion version = createDraftVersion(42L, 99L); // domainPackId=99, not 7
    given(versionRepository.findById(42L)).willReturn(Optional.of(version));

    assertThatThrownBy(
            () -> useCase.execute(new ActivateDomainPackVersionCommand(1L, 7L, 42L, 10L)))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }

  @Test
  @DisplayName("이미 PUBLISHED 상태 → DomainPackVersionInvalidStateException")
  void execute_alreadyPublished_throws400() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);

    DomainPackVersion published = createPublishedVersion(42L, 7L);
    given(versionRepository.findById(42L)).willReturn(Optional.of(published));

    assertThatThrownBy(
            () -> useCase.execute(new ActivateDomainPackVersionCommand(1L, 7L, 42L, 10L)))
        .isInstanceOf(DomainPackVersionInvalidStateException.class);
  }

  @Test
  @DisplayName("동시 활성화 충돌 → DomainPackVersionConflictException")
  void execute_optimisticLockFailure_throws409() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);

    DomainPackVersion version = createDraftVersion(42L, 7L);
    given(versionRepository.findById(42L)).willReturn(Optional.of(version));
    given(versionRepository.save(any()))
        .willThrow(new ObjectOptimisticLockingFailureException(DomainPackVersion.class, 42L));

    assertThatThrownBy(
            () -> useCase.execute(new ActivateDomainPackVersionCommand(1L, 7L, 42L, 10L)))
        .isInstanceOf(DomainPackVersionConflictException.class);
  }

  // ── factories ──────────────────────────────────────────────────────────────

  private DomainPackVersion newVersion() {
    try {
      Constructor<DomainPackVersion> ctor = DomainPackVersion.class.getDeclaredConstructor();
      ctor.setAccessible(true);
      return ctor.newInstance();
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  private DomainPackVersion createDraftVersion(Long id, Long domainPackId) {
    DomainPackVersion version = newVersion();
    ReflectionTestUtils.setField(version, "id", id);
    ReflectionTestUtils.setField(version, "domainPackId", domainPackId);
    ReflectionTestUtils.setField(version, "versionNo", 1);
    ReflectionTestUtils.setField(version, "lifecycleStatus", "DRAFT");
    ReflectionTestUtils.setField(version, "updatedAt", OffsetDateTime.now(FIXED_CLOCK));
    return version;
  }

  private DomainPackVersion createPublishedVersion(Long id, Long domainPackId) {
    DomainPackVersion version = newVersion();
    ReflectionTestUtils.setField(version, "id", id);
    ReflectionTestUtils.setField(version, "domainPackId", domainPackId);
    ReflectionTestUtils.setField(version, "versionNo", 1);
    ReflectionTestUtils.setField(version, "lifecycleStatus", "PUBLISHED");
    ReflectionTestUtils.setField(version, "publishedAt", OffsetDateTime.now(FIXED_CLOCK));
    ReflectionTestUtils.setField(version, "updatedAt", OffsetDateTime.now(FIXED_CLOCK));
    return version;
  }

  private DomainPackVersion createSavedVersion(Long id, Long domainPackId) {
    DomainPackVersion version = newVersion();
    ReflectionTestUtils.setField(version, "id", id);
    ReflectionTestUtils.setField(version, "domainPackId", domainPackId);
    ReflectionTestUtils.setField(version, "versionNo", 1);
    ReflectionTestUtils.setField(version, "lifecycleStatus", "PUBLISHED");
    ReflectionTestUtils.setField(
        version, "publishedAt", OffsetDateTime.parse("2026-04-09T12:00:00Z"));
    ReflectionTestUtils.setField(
        version, "updatedAt", OffsetDateTime.parse("2026-04-09T12:00:00Z"));
    return version;
  }
}
