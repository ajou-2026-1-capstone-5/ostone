package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.DomainPackVersionNotDraftException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.IntentWorkflowBindingRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("DomainPackDraftPersistenceService")
class DomainPackDraftPersistenceServiceTest {

  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;
  @Mock private SlotDefinitionRepository slotDefinitionRepository;
  @Mock private PolicyDefinitionRepository policyDefinitionRepository;
  @Mock private RiskDefinitionRepository riskDefinitionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock private IntentSlotBindingRepository intentSlotBindingRepository;
  @Mock private IntentWorkflowBindingRepository intentWorkflowBindingRepository;

  @InjectMocks private DomainPackDraftPersistenceService service;

  @Test
  @DisplayName("기존 DB에 있는 부모 intent를 참조해 child intent를 추가 저장할 수 있다")
  void persistIntents_resolvesParentIntentFromExistingVersionData() {
    DomainPackVersion version =
        DomainPackVersion.ofForTest(101L, 7L, DomainPackVersion.STATUS_DRAFT);
    IntentDefinition existingParent =
        IntentDefinition.create(101L, "refund_request", "환불 요청", null, 1, null, null, null, null);
    ReflectionTestUtils.setField(existingParent, "id", 55L);

    IntentDefinition savedChild =
        IntentDefinition.create(
            101L, "refund_request_cancel", "환불 요청 취소", null, 2, null, null, null, null);
    ReflectionTestUtils.setField(savedChild, "id", 77L);

    given(domainPackVersionRepository.findById(101L)).willReturn(Optional.of(version));
    given(
            intentDefinitionRepository.existsByDomainPackVersionIdAndIntentCode(
                101L, "refund_request_cancel"))
        .willReturn(false);
    given(intentDefinitionRepository.saveAllAndFlush(any()))
        .willReturn(List.of(savedChild))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(intentDefinitionRepository.findByDomainPackVersionIdAndIntentCode(101L, "refund_request"))
        .willReturn(Optional.of(existingParent));
    given(intentDefinitionRepository.countByDomainPackVersionId(101L)).willReturn(2L);

    AddIntentsToDraftVersionResult result =
        service.persistIntents(
            101L,
            List.of(
                new IntentDraft(
                    "refund_request_cancel",
                    "환불 요청 취소",
                    null,
                    2,
                    "refund_request",
                    null,
                    null,
                    null,
                    null)));

    ArgumentCaptor<List<IntentDefinition>> captor = ArgumentCaptor.forClass(List.class);
    verify(intentDefinitionRepository, times(2)).saveAllAndFlush(captor.capture());

    assertThat(captor.getAllValues().getLast()).hasSize(1);
    assertThat(captor.getAllValues().getLast().getFirst().getParentIntentId()).isEqualTo(55L);
    assertThat(result.domainPackId()).isEqualTo(7L);
    assertThat(result.addedIntentCount()).isEqualTo(1);
    assertThat(result.skippedIntentCount()).isEqualTo(0);
    assertThat(result.totalIntentCount()).isEqualTo(2);
  }

  @Test
  @DisplayName("같은 요청에 새 부모와 새 자식 intent가 함께 있으면 부모 ID를 연결해 저장한다")
  void persistIntents_linksNewParentAndChildAfterFlush() {
    DomainPackVersion version =
        DomainPackVersion.ofForTest(101L, 7L, DomainPackVersion.STATUS_DRAFT);
    IntentDefinition savedParent =
        IntentDefinition.create(101L, "refund_request", "환불 요청", null, 1, null, null, null, null);
    ReflectionTestUtils.setField(savedParent, "id", 55L);
    IntentDefinition savedChild =
        IntentDefinition.create(
            101L, "refund_request_cancel", "환불 요청 취소", null, 2, null, null, null, null);
    ReflectionTestUtils.setField(savedChild, "id", 77L);

    given(domainPackVersionRepository.findById(101L)).willReturn(Optional.of(version));
    given(
            intentDefinitionRepository.existsByDomainPackVersionIdAndIntentCode(
                101L, "refund_request"))
        .willReturn(false);
    given(
            intentDefinitionRepository.existsByDomainPackVersionIdAndIntentCode(
                101L, "refund_request_cancel"))
        .willReturn(false);
    given(intentDefinitionRepository.saveAllAndFlush(any()))
        .willReturn(List.of(savedParent, savedChild))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(intentDefinitionRepository.countByDomainPackVersionId(101L)).willReturn(2L);

    AddIntentsToDraftVersionResult result =
        service.persistIntents(
            101L,
            List.of(
                new IntentDraft("refund_request", "환불 요청", null, 1, null, null, null, null, null),
                new IntentDraft(
                    "refund_request_cancel",
                    "환불 요청 취소",
                    null,
                    2,
                    "refund_request",
                    null,
                    null,
                    null,
                    null)));

    assertThat(savedChild.getParentIntentId()).isEqualTo(55L);
    assertThat(result.addedIntentCount()).isEqualTo(2);
    assertThat(result.totalIntentCount()).isEqualTo(2);
  }

  @Test
  @DisplayName("존재하지 않는 버전이면 DomainPackVersionNotFoundException을 던진다")
  void persistIntents_missingVersion_throws() {
    given(domainPackVersionRepository.findById(101L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.persistIntents(101L, List.of()))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }

  @Test
  @DisplayName("DRAFT가 아닌 버전이면 DomainPackVersionNotDraftException을 던진다")
  void persistIntents_nonDraftVersion_throws() {
    DomainPackVersion version =
        DomainPackVersion.ofForTest(101L, 7L, DomainPackVersion.STATUS_PUBLISHED);
    given(domainPackVersionRepository.findById(101L)).willReturn(Optional.of(version));

    assertThatThrownBy(() -> service.persistIntents(101L, List.of()))
        .isInstanceOf(DomainPackVersionNotDraftException.class);
  }
}
