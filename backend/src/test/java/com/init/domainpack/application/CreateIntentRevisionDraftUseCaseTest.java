package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.DomainPackVersionInvalidStateException;
import com.init.domainpack.application.exception.DomainPackVersionNotCurrentException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("CreateIntentRevisionDraftUseCase")
class CreateIntentRevisionDraftUseCaseTest {

  @Mock private DomainPackValidator validator;
  @Mock private DomainPackVersionRepository versionRepository;
  @Mock private DomainPackVersionCloneService cloneService;

  private CreateIntentRevisionDraftUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new CreateIntentRevisionDraftUseCase(validator, versionRepository, cloneService);
  }

  @Test
  @DisplayName("현재 PUBLISHED version 기준으로 intent revision draft를 생성한다")
  void execute_success() {
    DomainPackVersion base = version(100L, 7L, 3, DomainPackVersion.STATUS_PUBLISHED);
    given(versionRepository.findById(100L)).willReturn(Optional.of(base));
    given(versionRepository.findCurrentPublishedByDomainPackId(7L)).willReturn(Optional.of(base));
    given(cloneService.cloneVersion(any()))
        .willReturn(
            new DomainPackVersionCloneResult(
                200L,
                4,
                DomainPackVersion.STATUS_DRAFT,
                DomainPackDraftSourceType.INTENT_REVISION,
                100L,
                3,
                "보정"));

    IntentRevisionDraftResult result =
        useCase.execute(new CreateIntentRevisionDraftCommand(1L, 7L, 100L, 10L, "보정"));

    assertThat(result.draftVersion().versionId()).isEqualTo(200L);
    assertThat(result.draftVersion().sourceType()).isEqualTo("INTENT_REVISION");
    verify(validator).lockDomainPack(7L, 1L);
    ArgumentCaptor<DomainPackVersionCloneCommand> captor =
        ArgumentCaptor.forClass(DomainPackVersionCloneCommand.class);
    verify(cloneService).cloneVersion(captor.capture());
    assertThat(captor.getValue().workspaceId()).isEqualTo(1L);
    assertThat(captor.getValue().packId()).isEqualTo(7L);
    assertThat(captor.getValue().baseVersion()).isSameAs(base);
    assertThat(captor.getValue().createdBy()).isEqualTo(10L);
    assertThat(captor.getValue().sourceType()).isEqualTo(DomainPackDraftSourceType.INTENT_REVISION);
    assertThat(captor.getValue().reason()).isEqualTo("보정");
  }

  @Test
  @DisplayName("PUBLISHED 상태가 아닌 version이면 draft 생성을 거부한다")
  void execute_whenBaseVersionIsNotPublished_throws() {
    DomainPackVersion draft = version(100L, 7L, 3, DomainPackVersion.STATUS_DRAFT);
    given(versionRepository.findById(100L)).willReturn(Optional.of(draft));

    assertThatThrownBy(
            () -> useCase.execute(new CreateIntentRevisionDraftCommand(1L, 7L, 100L, 10L, null)))
        .isInstanceOf(DomainPackVersionInvalidStateException.class);
  }

  @Test
  @DisplayName("현재 운영 version이 아니면 intent revision draft를 만들 수 없다")
  void execute_whenBaseVersionIsNotCurrent_throws() {
    DomainPackVersion base = version(100L, 7L, 2, DomainPackVersion.STATUS_PUBLISHED);
    DomainPackVersion current = version(101L, 7L, 3, DomainPackVersion.STATUS_PUBLISHED);
    given(versionRepository.findById(100L)).willReturn(Optional.of(base));
    given(versionRepository.findCurrentPublishedByDomainPackId(7L))
        .willReturn(Optional.of(current));

    assertThatThrownBy(
            () -> useCase.execute(new CreateIntentRevisionDraftCommand(1L, 7L, 100L, 10L, null)))
        .isInstanceOf(DomainPackVersionNotCurrentException.class);
  }

  private DomainPackVersion version(Long id, Long packId, Integer versionNo, String status) {
    DomainPackVersion version = DomainPackVersion.ofForTest(id, packId, status);
    ReflectionTestUtils.setField(version, "versionNo", versionNo);
    ReflectionTestUtils.setField(version, "summaryJson", "{}");
    return version;
  }
}
