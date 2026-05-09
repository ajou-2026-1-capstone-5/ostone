package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.exception.DomainPackVersionInvalidStateException;
import com.init.domainpack.application.exception.IntentRevisionTargetNotPublishedException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("UpdateDraftIntentUseCase")
class UpdateDraftIntentUseCaseTest {

  @Mock private DomainPackValidator validator;
  @Mock private DomainPackVersionRepository versionRepository;
  @Mock private IntentDefinitionRepository intentRepository;

  private UpdateDraftIntentUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new UpdateDraftIntentUseCase(
            validator, versionRepository, intentRepository, new ObjectMapper());
  }

  @Test
  @DisplayName("DRAFT version의 PUBLISHED intent 정의를 수정한다")
  void execute_success() {
    DomainPackVersion version = version(200L, 7L, DomainPackVersion.STATUS_DRAFT);
    IntentDefinition intent = intent(300L, 200L, IntentDefinition.STATUS_PUBLISHED);
    given(versionRepository.findById(200L)).willReturn(Optional.of(version));
    given(intentRepository.findByIdAndDomainPackVersionId(300L, 200L))
        .willReturn(Optional.of(intent));
    given(intentRepository.save(any(IntentDefinition.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    IntentDefinitionDetail result =
        useCase.execute(
            new UpdateDraftIntentCommand(
                1L, 7L, 200L, 300L, 10L, "환불 변경", "설명", 2, "{\"ok\":true}", "{\"tag\":\"x\"}"));

    assertThat(result.id()).isEqualTo(300L);
    assertThat(result.name()).isEqualTo("환불 변경");
    assertThat(result.taxonomyLevel()).isEqualTo(2);
    verify(intentRepository).save(intent);
  }

  @Test
  @DisplayName("DRAFT version이 아니면 intent 수정이 불가능하다")
  void execute_whenVersionIsNotDraft_throws() {
    DomainPackVersion version = version(200L, 7L, DomainPackVersion.STATUS_PUBLISHED);
    given(versionRepository.findById(200L)).willReturn(Optional.of(version));

    assertThatThrownBy(() -> executeWithJson("{\"ok\":true}", "{}"))
        .isInstanceOf(DomainPackVersionInvalidStateException.class);
  }

  @Test
  @DisplayName("수정 대상 intent가 PUBLISHED 상태가 아니면 거부한다")
  void execute_whenIntentIsNotPublished_throws() {
    DomainPackVersion version = version(200L, 7L, DomainPackVersion.STATUS_DRAFT);
    IntentDefinition intent = intent(300L, 200L, IntentDefinition.STATUS_DRAFT);
    given(versionRepository.findById(200L)).willReturn(Optional.of(version));
    given(intentRepository.findByIdAndDomainPackVersionId(300L, 200L))
        .willReturn(Optional.of(intent));

    assertThatThrownBy(() -> executeWithJson("{\"ok\":true}", "{}"))
        .isInstanceOf(IntentRevisionTargetNotPublishedException.class);
  }

  @Test
  @DisplayName("JSON object가 아닌 필드는 BadRequestException으로 변환한다")
  void execute_whenJsonIsNotObject_throwsBadRequest() {
    DomainPackVersion version = version(200L, 7L, DomainPackVersion.STATUS_DRAFT);
    IntentDefinition intent = intent(300L, 200L, IntentDefinition.STATUS_PUBLISHED);
    given(versionRepository.findById(200L)).willReturn(Optional.of(version));
    given(intentRepository.findByIdAndDomainPackVersionId(300L, 200L))
        .willReturn(Optional.of(intent));

    assertThatThrownBy(() -> executeWithJson("[]", "{}")).isInstanceOf(BadRequestException.class);
  }

  @Test
  @DisplayName("도메인 검증 예외는 cause를 보존한 BadRequestException으로 변환한다")
  void execute_whenDomainValidationFails_preservesCause() {
    DomainPackVersion version = version(200L, 7L, DomainPackVersion.STATUS_DRAFT);
    IntentDefinition intent = intent(300L, 200L, IntentDefinition.STATUS_PUBLISHED);
    given(versionRepository.findById(200L)).willReturn(Optional.of(version));
    given(intentRepository.findByIdAndDomainPackVersionId(300L, 200L))
        .willReturn(Optional.of(intent));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateDraftIntentCommand(1L, 7L, 200L, 300L, 10L, "", null, 1, "{}", "{}")))
        .isInstanceOf(BadRequestException.class)
        .hasCauseInstanceOf(IllegalArgumentException.class);
  }

  private void executeWithJson(String entryConditionJson, String metaJson) {
    useCase.execute(
        new UpdateDraftIntentCommand(
            1L, 7L, 200L, 300L, 10L, "환불 변경", "설명", 2, entryConditionJson, metaJson));
  }

  private DomainPackVersion version(Long id, Long packId, String status) {
    DomainPackVersion version = DomainPackVersion.ofForTest(id, packId, status);
    ReflectionTestUtils.setField(version, "versionNo", 3);
    ReflectionTestUtils.setField(version, "summaryJson", "{}");
    return version;
  }

  private IntentDefinition intent(Long id, Long versionId, String status) {
    IntentDefinition intent =
        IntentDefinition.create(versionId, "refund", "환불", null, 1, "{}", "{}", "[]", "{}");
    ReflectionTestUtils.setField(intent, "id", id);
    ReflectionTestUtils.setField(intent, "status", status);
    return intent;
  }
}
