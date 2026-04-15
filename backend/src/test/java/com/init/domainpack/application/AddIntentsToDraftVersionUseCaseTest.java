package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.application.exception.DomainPackVersionNotDraftException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.shared.application.exception.NotFoundException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("AddIntentsToDraftVersionUseCase")
class AddIntentsToDraftVersionUseCaseTest {

  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private DomainPackDraftPersistenceService domainPackDraftPersistenceService;
  @InjectMocks private AddIntentsToDraftVersionUseCase useCase;

  @Test
  @DisplayName("DRAFT 버전에 intent를 정상적으로 추가한다")
  void execute_success_addsIntents() {
    DomainPackVersion version = DomainPackVersion.ofForTest(101L, 7L, "DRAFT");
    given(domainPackVersionRepository.findById(101L)).willReturn(Optional.of(version));
    given(domainPackDraftPersistenceService.persistIntents(eq(101L), any()))
        .willReturn(new AddIntentsToDraftVersionResult(101L, 7L, 2, 0, 5));

    List<CreateDomainPackDraftCommand.IntentDraft> intents =
        List.of(
            new CreateDomainPackDraftCommand.IntentDraft(
                "refund_request", "환불 요청", null, 1, null, null, null, null, null),
            new CreateDomainPackDraftCommand.IntentDraft(
                "refund_cancel", "환불 취소", null, 1, null, null, null, null, null));

    AddIntentsToDraftVersionResult result =
        useCase.execute(new AddIntentsToDraftVersionCommand(101L, intents));

    assertThat(result.domainPackId()).isEqualTo(7L);
    assertThat(result.addedIntentCount()).isEqualTo(2);
    assertThat(result.skippedIntentCount()).isEqualTo(0);
    assertThat(result.totalIntentCount()).isEqualTo(5);
  }

  @Test
  @DisplayName("중복된 intentCode는 건너뛰고 나머지만 저장한다")
  void execute_duplicateIntents_skipsExisting() {
    DomainPackVersion version = DomainPackVersion.ofForTest(101L, 7L, "DRAFT");
    given(domainPackVersionRepository.findById(101L)).willReturn(Optional.of(version));
    given(domainPackDraftPersistenceService.persistIntents(eq(101L), any()))
        .willReturn(new AddIntentsToDraftVersionResult(101L, 7L, 1, 1, 4));

    List<CreateDomainPackDraftCommand.IntentDraft> intents =
        List.of(
            new CreateDomainPackDraftCommand.IntentDraft(
                "existing_intent", "기존 의도", null, 1, null, null, null, null, null),
            new CreateDomainPackDraftCommand.IntentDraft(
                "new_intent", "새 의도", null, 1, null, null, null, null, null));

    AddIntentsToDraftVersionResult result =
        useCase.execute(new AddIntentsToDraftVersionCommand(101L, intents));

    assertThat(result.addedIntentCount()).isEqualTo(1);
    assertThat(result.skippedIntentCount()).isEqualTo(1);
    assertThat(result.totalIntentCount()).isEqualTo(4);
  }

  @Test
  @DisplayName("버전이 존재하지 않으면 NotFoundException을 던진다")
  void execute_versionNotFound_throws() {
    given(domainPackVersionRepository.findById(999L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> useCase.execute(new AddIntentsToDraftVersionCommand(999L, List.of())))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("999");
  }

  @Test
  @DisplayName("DRAFT 상태가 아닌 버전이면 DomainPackVersionNotDraftException을 던진다")
  void execute_publishedVersion_throws() {
    DomainPackVersion version = DomainPackVersion.ofForTest(101L, 7L, "PUBLISHED");
    given(domainPackVersionRepository.findById(101L)).willReturn(Optional.of(version));

    assertThatThrownBy(() -> useCase.execute(new AddIntentsToDraftVersionCommand(101L, List.of())))
        .isInstanceOf(DomainPackVersionNotDraftException.class)
        .hasMessageContaining("101");
  }
}
