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
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
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
@DisplayName("UpdateIntentStatusUseCase")
class UpdateIntentStatusUseCaseTest {

  @Mock private IntentDefinitionRepository intentRepository;
  @Mock private DomainPackVersionRepository versionRepository;
  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;

  private UpdateIntentStatusUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new UpdateIntentStatusUseCase(
            intentRepository, versionRepository, workspaceExistencePort, workspaceMembershipPort);
  }

  @Test
  @DisplayName("정상 전환: DRAFT → PUBLISHED")
  void should_PUBLISHED전환성공_when_DRAFT버전인텐트() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    IntentDefinition intent = intent(99L, 10L);
    ReflectionTestUtils.setField(intent, "status", IntentDefinition.STATUS_DRAFT);
    given(intentRepository.findById(99L)).willReturn(Optional.of(intent));
    given(intentRepository.save(any())).willReturn(intent);

    UpdateIntentStatusCommand command =
        new UpdateIntentStatusCommand(1L, 7L, 10L, 99L, 5L, IntentDefinition.STATUS_PUBLISHED);
    IntentDefinitionStatusResponse result = useCase.execute(command);

    assertThat(result.status()).isEqualTo(IntentDefinition.STATUS_PUBLISHED);
  }

  @Test
  @DisplayName("정상 전환: ACTIVE → PUBLISHED")
  void should_PUBLISHED전환성공_when_ACTIVE인텐트() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    IntentDefinition intent = intent(99L, 10L);
    given(intentRepository.findById(99L)).willReturn(Optional.of(intent));
    given(intentRepository.save(any())).willReturn(intent);

    UpdateIntentStatusCommand command =
        new UpdateIntentStatusCommand(1L, 7L, 10L, 99L, 5L, IntentDefinition.STATUS_PUBLISHED);
    IntentDefinitionStatusResponse result = useCase.execute(command);

    assertThat(result.status()).isEqualTo(IntentDefinition.STATUS_PUBLISHED);
  }

  @Test
  @DisplayName("허용되지 않는 status 값 → BadRequestException(VALIDATION_ERROR)")
  void should_VALIDATION_ERROR예외_when_잘못된status() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    IntentDefinition intent = intent(99L, 10L);
    given(intentRepository.findById(99L)).willReturn(Optional.of(intent));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateIntentStatusCommand(1L, 7L, 10L, 99L, 5L, "DEPRECATED")))
        .isInstanceOf(BadRequestException.class);
  }

  @Test
  @DisplayName("PUBLISHED 버전 → BadRequestException(INTENT_NOT_EDITABLE)")
  void should_INTENT_NOT_EDITABLE예외_when_PUBLISHED버전() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L))
        .willReturn(
            Optional.of(DomainPackVersion.ofForTest(10L, 7L, DomainPackVersion.STATUS_PUBLISHED)));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateIntentStatusCommand(
                        1L, 7L, 10L, 99L, 5L, IntentDefinition.STATUS_PUBLISHED)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("DRAFT");
  }

  @Test
  @DisplayName("Intent의 versionId 불일치 → NotFoundException")
  void should_인텐트없음예외_when_versionId불일치() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));

    IntentDefinition intent = intent(99L, 999L);
    given(intentRepository.findById(99L)).willReturn(Optional.of(intent));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateIntentStatusCommand(
                        1L, 7L, 10L, 99L, 5L, IntentDefinition.STATUS_PUBLISHED)))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("workspace 없음 → DomainPackWorkspaceNotFoundException")
  void should_워크스페이스없음예외_when_워크스페이스없음() {
    given(workspaceExistencePort.existsById(1L)).willReturn(false);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateIntentStatusCommand(
                        1L, 7L, 10L, 99L, 5L, IntentDefinition.STATUS_PUBLISHED)))
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
                    new UpdateIntentStatusCommand(
                        1L, 7L, 10L, 99L, 5L, IntentDefinition.STATUS_PUBLISHED)))
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
                    new UpdateIntentStatusCommand(
                        1L, 7L, 10L, 99L, 5L, IntentDefinition.STATUS_PUBLISHED)))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("packId 불일치 → NotFoundException")
  void should_버전없음예외_when_packId불일치() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);

    DomainPackVersion version = draftVersion(10L, 99L);
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateIntentStatusCommand(
                        1L, 7L, 10L, 99L, 5L, IntentDefinition.STATUS_PUBLISHED)))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("Intent 미존재 → NotFoundException")
  void should_인텐트없음예외_when_인텐트미존재() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(versionRepository.findById(10L)).willReturn(Optional.of(draftVersion(10L, 7L)));
    given(intentRepository.findById(99L)).willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateIntentStatusCommand(
                        1L, 7L, 10L, 99L, 5L, IntentDefinition.STATUS_PUBLISHED)))
        .isInstanceOf(NotFoundException.class);
  }

  private DomainPackVersion draftVersion(Long id, Long domainPackId) {
    return DomainPackVersion.ofForTest(id, domainPackId, DomainPackVersion.STATUS_DRAFT);
  }

  private IntentDefinition intent(Long id, Long versionId) {
    IntentDefinition i =
        IntentDefinition.create(
            versionId, "HELP_REQUEST", "도움요청", "사용자가 도움을 요청합니다.", 1, "{}", "{}", "[]", "{}");
    ReflectionTestUtils.setField(i, "id", id);
    return i;
  }
}
