package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
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
@DisplayName("UpdateSlotUseCase")
class UpdateSlotUseCaseTest {

  @Mock private DomainPackValidator validator;
  @Mock private SlotDefinitionRepository slotRepository;
  @Mock private DomainPackVersionRepository versionRepository;

  private UpdateSlotUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new UpdateSlotUseCase(validator, slotRepository, versionRepository);
  }

  @Test
  @DisplayName("정상 수정: DRAFT 버전의 슬롯 → 200 OK, 수정된 슬롯 반환")
  void should_수정성공_when_DRAFT버전슬롯() {
    DomainPackVersion version = draftVersion(10L, 7L);
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));

    SlotDefinition slot = slot(99L, 10L);
    given(slotRepository.findByIdOrThrow(99L)).willReturn(slot);
    given(slotRepository.save(any())).willReturn(slot);

    UpdateSlotCommand command =
        new UpdateSlotCommand(1L, 7L, 10L, 99L, 5L, "수정된 이름", "설명", false, "{}", null, "{}");
    SlotDefinitionResponse result = useCase.execute(command);

    assertThat(result.name()).isEqualTo("수정된 이름");
    verify(slotRepository).save(slot);
  }

  @Test
  @DisplayName("workspace 없음 → DomainPackWorkspaceNotFoundException")
  void should_워크스페이스없음예외_when_워크스페이스없음() {
    doThrow(new DomainPackWorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다. id=1"))
        .when(validator)
        .validateWorkspaceAccess(anyLong(), anyLong());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotCommand(
                        1L, 7L, 10L, 99L, 5L, "이름", null, null, null, null, null)))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);

    verify(versionRepository, never()).findById(any());
    verify(slotRepository, never()).save(any());
  }

  @Test
  @DisplayName("workspace 비멤버 → DomainPackUnauthorizedWorkspaceAccessException")
  void should_권한없음예외_when_비멤버() {
    doThrow(new DomainPackUnauthorizedWorkspaceAccessException("워크스페이스에 접근 권한이 없습니다."))
        .when(validator)
        .validateWorkspaceAccess(anyLong(), anyLong());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotCommand(
                        1L, 7L, 10L, 99L, 5L, "이름", null, null, null, null, null)))
        .isInstanceOf(DomainPackUnauthorizedWorkspaceAccessException.class);

    verify(versionRepository, never()).findById(any());
    verify(slotRepository, never()).save(any());
  }

  @Test
  @DisplayName("버전 미존재 → NotFoundException")
  void should_버전없음예외_when_버전미존재() {
    given(versionRepository.findById(10L)).willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotCommand(
                        1L, 7L, 10L, 99L, 5L, "이름", null, null, null, null, null)))
        .isInstanceOf(NotFoundException.class);

    verify(slotRepository, never()).save(any());
  }

  @Test
  @DisplayName("packId 불일치 → NotFoundException")
  void should_버전없음예외_when_packId불일치() {
    DomainPackVersion version = draftVersion(10L, 99L); // domainPackId=99, not 7
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotCommand(
                        1L, 7L, 10L, 99L, 5L, "이름", null, null, null, null, null)))
        .isInstanceOf(NotFoundException.class);

    verify(slotRepository, never()).save(any());
  }

  @Test
  @DisplayName("PUBLISHED 버전 → BadRequestException(SLOT_NOT_EDITABLE)")
  void should_SLOT_NOT_EDITABLE예외_when_PUBLISHED버전() {
    DomainPackVersion version = publishedVersion(10L, 7L);
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotCommand(
                        1L, 7L, 10L, 99L, 5L, "이름", null, null, null, null, null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("DRAFT");

    verify(slotRepository, never()).save(any());
  }

  @Test
  @DisplayName("슬롯 미존재 → NotFoundException")
  void should_슬롯없음예외_when_슬롯미존재() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));
    given(slotRepository.findByIdOrThrow(99L))
        .willThrow(new NotFoundException("NOT_FOUND", "슬롯을 찾을 수 없습니다: 99"));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotCommand(
                        1L, 7L, 10L, 99L, 5L, "이름", null, null, null, null, null)))
        .isInstanceOf(NotFoundException.class);

    verify(slotRepository, never()).save(any());
  }

  @Test
  @DisplayName("슬롯의 versionId 불일치 → NotFoundException")
  void should_슬롯없음예외_when_versionId불일치() {
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    SlotDefinition slot = slot(99L, 999L); // 다른 버전에 속한 슬롯
    given(slotRepository.findByIdOrThrow(99L)).willReturn(slot);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSlotCommand(
                        1L, 7L, 10L, 99L, 5L, "이름", null, null, null, null, null)))
        .isInstanceOf(NotFoundException.class);

    verify(slotRepository, never()).save(any());
  }

  // ── factories ──────────────────────────────────────────────────────────────

  private DomainPackVersion draftVersion(Long id, Long domainPackId) {
    return DomainPackVersion.ofForTest(id, domainPackId, DomainPackVersion.STATUS_DRAFT);
  }

  private DomainPackVersion publishedVersion(Long id, Long domainPackId) {
    return DomainPackVersion.ofForTest(id, domainPackId, DomainPackVersion.STATUS_PUBLISHED);
  }

  private SlotDefinition slot(Long id, Long versionId) {
    SlotDefinition s =
        SlotDefinition.create(versionId, "code", "이름", "설명", "STRING", false, "{}", null, "{}");
    ReflectionTestUtils.setField(s, "id", id);
    return s;
  }
}
