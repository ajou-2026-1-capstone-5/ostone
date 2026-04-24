package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("UpdateSlotStatusUseCase")
class UpdateSlotStatusUseCaseTest {

  @Mock private SlotDefinitionRepository slotRepository;
  @Mock private DomainPackVersionRepository versionRepository;
  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;

  private UpdateSlotStatusUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new UpdateSlotStatusUseCase(
            slotRepository, versionRepository, workspaceExistencePort, workspaceMembershipPort);
  }

  @Test
  @DisplayName("정상 전환: ACTIVE → INACTIVE")
  void should_INACTIVE전환성공_when_DRAFT버전슬롯() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    SlotDefinition slot = slot(99L, 10L);
    given(slotRepository.findByIdOrThrow(99L)).willReturn(slot);
    given(slotRepository.save(any())).willReturn(slot);

    UpdateSlotStatusCommand command =
        new UpdateSlotStatusCommand(1L, 7L, 10L, 99L, 5L, SlotDefinition.STATUS_INACTIVE);
    SlotDefinitionResponse result = useCase.execute(command);

    assertThat(result.status()).isEqualTo(SlotDefinition.STATUS_INACTIVE);
  }

  @Test
  @DisplayName("정상 전환: INACTIVE → ACTIVE")
  void should_ACTIVE전환성공_when_INACTIVE슬롯() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    SlotDefinition slot = slot(99L, 10L);
    ReflectionTestUtils.setField(slot, "status", SlotDefinition.STATUS_INACTIVE);
    given(slotRepository.findByIdOrThrow(99L)).willReturn(slot);
    given(slotRepository.save(any())).willReturn(slot);

    UpdateSlotStatusCommand command =
        new UpdateSlotStatusCommand(1L, 7L, 10L, 99L, 5L, SlotDefinition.STATUS_ACTIVE);
    SlotDefinitionResponse result = useCase.execute(command);

    assertThat(result.status()).isEqualTo(SlotDefinition.STATUS_ACTIVE);
  }

  @Test
  @DisplayName("허용되지 않는 status 값 → BadRequestException(VALIDATION_ERROR)")
  void should_VALIDATION_ERROR예외_when_잘못된status() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    SlotDefinition slot = slot(99L, 10L);
    given(slotRepository.findByIdOrThrow(99L)).willReturn(slot);

    assertThatThrownBy(
            () -> useCase.execute(new UpdateSlotStatusCommand(1L, 7L, 10L, 99L, 5L, "DEPRECATED")))
        .isInstanceOf(BadRequestException.class);
  }

  @Test
  @DisplayName("PUBLISHED 버전 → BadRequestException(SLOT_NOT_EDITABLE)")
  void should_SLOT_NOT_EDITABLE예외_when_PUBLISHED버전() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L))
        .willReturn(
            Optional.of(DomainPackVersion.ofForTest(10L, 7L, DomainPackVersion.STATUS_PUBLISHED)));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotStatusCommand(
                        1L, 7L, 10L, 99L, 5L, SlotDefinition.STATUS_INACTIVE)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("DRAFT");
  }

  @Test
  @DisplayName("슬롯의 versionId 불일치 → NotFoundException")
  void should_슬롯없음예외_when_versionId불일치() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    SlotDefinition slot = slot(99L, 999L); // 다른 버전에 속한 슬롯
    given(slotRepository.findByIdOrThrow(99L)).willReturn(slot);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotStatusCommand(
                        1L, 7L, 10L, 99L, 5L, SlotDefinition.STATUS_INACTIVE)))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("workspace 없음 → DomainPackWorkspaceNotFoundException")
  void should_워크스페이스없음예외_when_워크스페이스없음() {
    given(workspaceExistencePort.existsById(1L)).willReturn(false);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotStatusCommand(
                        1L, 7L, 10L, 99L, 5L, SlotDefinition.STATUS_INACTIVE)))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);

    verify(versionRepository, never()).findById(any());
  }

  @Test
  @DisplayName("workspace 비멤버 → DomainPackUnauthorizedWorkspaceAccessException")
  void should_권한없음예외_when_비멤버() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(false);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotStatusCommand(
                        1L, 7L, 10L, 99L, 5L, SlotDefinition.STATUS_INACTIVE)))
        .isInstanceOf(DomainPackUnauthorizedWorkspaceAccessException.class);

    verify(versionRepository, never()).findById(any());
  }

  @Test
  @DisplayName("버전 미존재 → NotFoundException")
  void should_버전없음예외_when_버전미존재() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotStatusCommand(
                        1L, 7L, 10L, 99L, 5L, SlotDefinition.STATUS_INACTIVE)))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("packId 불일치 → NotFoundException")
  void should_버전없음예외_when_packId불일치() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);

    DomainPackVersion version = draftVersion(10L, 99L); // domainPackId=99, not 7
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotStatusCommand(
                        1L, 7L, 10L, 99L, 5L, SlotDefinition.STATUS_INACTIVE)))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("슬롯 미존재 → NotFoundException")
  void should_슬롯없음예외_when_슬롯미존재() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));
    given(slotRepository.findByIdOrThrow(99L))
        .willThrow(new NotFoundException("NOT_FOUND", "슬롯을 찾을 수 없습니다: 99"));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotStatusCommand(
                        1L, 7L, 10L, 99L, 5L, SlotDefinition.STATUS_INACTIVE)))
        .isInstanceOf(NotFoundException.class);
  }

  // ── factories ──────────────────────────────────────────────────────────────

  private DomainPackVersion draftVersion(Long id, Long domainPackId) {
    return DomainPackVersion.ofForTest(id, domainPackId, DomainPackVersion.STATUS_DRAFT);
  }

  private SlotDefinition slot(Long id, Long versionId) {
    SlotDefinition s =
        SlotDefinition.create(versionId, "code", "이름", "설명", "STRING", false, "{}", null, "{}");
    ReflectionTestUtils.setField(s, "id", id);
    return s;
  }
}
