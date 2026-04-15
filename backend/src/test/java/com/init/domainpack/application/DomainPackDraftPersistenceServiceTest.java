package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

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
    given(intentDefinitionRepository.saveAll(any())).willReturn(List.of(savedChild));
    given(intentDefinitionRepository.findByDomainPackVersionIdAndIntentCode(101L, "refund_request"))
        .willReturn(Optional.of(existingParent));
    given(intentDefinitionRepository.saveAllAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(intentDefinitionRepository.countByDomainPackVersionId(101L)).willReturn(2L);

    AddIntentsToDraftVersionResult result =
        service.persistIntents(
            101L,
            List.of(
                new CreateDomainPackDraftCommand.IntentDraft(
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
    verify(intentDefinitionRepository).saveAllAndFlush(captor.capture());

    assertThat(captor.getValue()).hasSize(1);
    assertThat(captor.getValue().getFirst().getParentIntentId()).isEqualTo(55L);
    assertThat(result.domainPackId()).isEqualTo(7L);
    assertThat(result.addedIntentCount()).isEqualTo(1);
    assertThat(result.skippedIntentCount()).isEqualTo(0);
    assertThat(result.totalIntentCount()).isEqualTo(2);
  }
}
