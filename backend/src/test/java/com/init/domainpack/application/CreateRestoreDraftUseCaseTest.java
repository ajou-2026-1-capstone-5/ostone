package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.RestoreSourceNotPreviousPublishedException;
import com.init.domainpack.application.exception.RestoreSourceNotPublishedException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("CreateRestoreDraftUseCase")
class CreateRestoreDraftUseCaseTest {

  @Mock private DomainPackValidator validator;
  @Mock private DomainPackVersionRepository versionRepository;
  @Mock private DomainPackVersionCloneService cloneService;

  private CreateRestoreDraftUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new CreateRestoreDraftUseCase(validator, versionRepository, cloneService);
  }

  @Test
  @DisplayName("이전 PUBLISHED version 기준으로 restore draft를 생성한다")
  void execute_success() {
    DomainPackVersion base = version(100L, 7L, 2, DomainPackVersion.STATUS_PUBLISHED);
    DomainPackVersion current = version(101L, 7L, 3, DomainPackVersion.STATUS_PUBLISHED);
    given(versionRepository.findById(100L)).willReturn(Optional.of(base));
    given(versionRepository.findCurrentPublishedByDomainPackId(7L))
        .willReturn(Optional.of(current));
    given(cloneService.cloneVersion(any()))
        .willReturn(
            new DomainPackVersionCloneResult(
                200L,
                4,
                DomainPackVersion.STATUS_DRAFT,
                DomainPackDraftSourceType.RESTORE,
                100L,
                2,
                "복원"));

    RestoreDraftResult result =
        useCase.execute(new CreateRestoreDraftCommand(1L, 7L, 100L, 10L, "복원"));

    assertThat(result.draftVersion().versionId()).isEqualTo(200L);
    assertThat(result.draftVersion().sourceType()).isEqualTo("RESTORE");
    verify(validator).lockDomainPack(7L, 1L);
  }

  @Test
  @DisplayName("PUBLISHED 상태가 아닌 source version은 restore 기준이 될 수 없다")
  void execute_whenBaseVersionIsNotPublished_throws() {
    DomainPackVersion draft = version(100L, 7L, 2, DomainPackVersion.STATUS_DRAFT);
    given(versionRepository.findById(100L)).willReturn(Optional.of(draft));

    assertThatThrownBy(
            () -> useCase.execute(new CreateRestoreDraftCommand(1L, 7L, 100L, 10L, null)))
        .isInstanceOf(RestoreSourceNotPublishedException.class);
  }

  @Test
  @DisplayName("현재 version 이상은 restore draft 기준이 될 수 없다")
  void execute_whenBaseVersionIsNotPrevious_throws() {
    DomainPackVersion base = version(101L, 7L, 3, DomainPackVersion.STATUS_PUBLISHED);
    DomainPackVersion current = version(101L, 7L, 3, DomainPackVersion.STATUS_PUBLISHED);
    given(versionRepository.findById(101L)).willReturn(Optional.of(base));
    given(versionRepository.findCurrentPublishedByDomainPackId(7L))
        .willReturn(Optional.of(current));

    assertThatThrownBy(
            () -> useCase.execute(new CreateRestoreDraftCommand(1L, 7L, 101L, 10L, null)))
        .isInstanceOf(RestoreSourceNotPreviousPublishedException.class);
  }

  private DomainPackVersion version(Long id, Long packId, Integer versionNo, String status) {
    DomainPackVersion version = DomainPackVersion.ofForTest(id, packId, status);
    ReflectionTestUtils.setField(version, "versionNo", versionNo);
    ReflectionTestUtils.setField(version, "summaryJson", "{}");
    return version;
  }
}
