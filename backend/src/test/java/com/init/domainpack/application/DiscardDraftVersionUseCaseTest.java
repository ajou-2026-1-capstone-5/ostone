package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.DomainPackDraftInUseException;
import com.init.domainpack.application.exception.DomainPackVersionInvalidStateException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionReferencePort;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("DiscardDraftVersionUseCase")
class DiscardDraftVersionUseCaseTest {

  @Mock private DomainPackValidator validator;
  @Mock private DomainPackVersionRepository versionRepository;
  @Mock private DomainPackVersionReferencePort referencePort;

  private DiscardDraftVersionUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new DiscardDraftVersionUseCase(validator, versionRepository, referencePort);
  }

  @Test
  @DisplayName("참조 없는 DRAFT version을 삭제하고 flush한다")
  void execute_success() {
    DomainPackVersion version = version(200L, 7L, DomainPackVersion.STATUS_DRAFT);
    given(versionRepository.findByIdForUpdate(200L)).willReturn(Optional.of(version));
    given(referencePort.existsExternalReference(200L)).willReturn(false);

    useCase.execute(new DiscardDraftVersionCommand(1L, 7L, 200L, 10L));

    verify(versionRepository).delete(version);
    verify(versionRepository).flush();
  }

  @Test
  @DisplayName("DRAFT가 아닌 version은 폐기할 수 없다")
  void execute_whenVersionIsNotDraft_throws() {
    DomainPackVersion version = version(200L, 7L, DomainPackVersion.STATUS_PUBLISHED);
    given(versionRepository.findByIdForUpdate(200L)).willReturn(Optional.of(version));

    assertThatThrownBy(() -> useCase.execute(new DiscardDraftVersionCommand(1L, 7L, 200L, 10L)))
        .isInstanceOf(DomainPackVersionInvalidStateException.class);
  }

  @Test
  @DisplayName("외부 참조가 있으면 DRAFT version을 폐기할 수 없다")
  void execute_whenReferenceExists_throws() {
    DomainPackVersion version = version(200L, 7L, DomainPackVersion.STATUS_DRAFT);
    given(versionRepository.findByIdForUpdate(200L)).willReturn(Optional.of(version));
    given(referencePort.existsExternalReference(200L)).willReturn(true);

    assertThatThrownBy(() -> useCase.execute(new DiscardDraftVersionCommand(1L, 7L, 200L, 10L)))
        .isInstanceOf(DomainPackDraftInUseException.class);
  }

  @Test
  @DisplayName("flush 중 FK 제약 예외가 발생하면 cause를 보존해 변환한다")
  void execute_whenFlushFails_preservesCause() {
    DomainPackVersion version = version(200L, 7L, DomainPackVersion.STATUS_DRAFT);
    given(versionRepository.findByIdForUpdate(200L)).willReturn(Optional.of(version));
    given(referencePort.existsExternalReference(200L)).willReturn(false);
    org.mockito.Mockito.doThrow(new DataIntegrityViolationException("fk"))
        .when(versionRepository)
        .flush();

    assertThatThrownBy(() -> useCase.execute(new DiscardDraftVersionCommand(1L, 7L, 200L, 10L)))
        .isInstanceOf(DomainPackDraftInUseException.class)
        .hasCauseInstanceOf(DataIntegrityViolationException.class);
  }

  private DomainPackVersion version(Long id, Long packId, String status) {
    DomainPackVersion version = DomainPackVersion.ofForTest(id, packId, status);
    ReflectionTestUtils.setField(version, "versionNo", 3);
    ReflectionTestUtils.setField(version, "summaryJson", "{}");
    return version;
  }
}
