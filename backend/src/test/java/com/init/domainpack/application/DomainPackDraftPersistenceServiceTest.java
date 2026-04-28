package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.DomainPackVersionNotDraftException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.IntentWorkflowBinding;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.IntentWorkflowBindingRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.invocation.InvocationOnMock;
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

  @Test
  @DisplayName("기존 DRAFT version의 intent를 참조해 workflow draft 산출물을 적재한다")
  void persistWorkflowDraft_success_usesExistingIntent() {
    DomainPackVersion version =
        DomainPackVersion.ofForTest(101L, 7L, DomainPackVersion.STATUS_DRAFT);
    IntentDefinition existingIntent =
        IntentDefinition.create(101L, "refund_request", "환불 요청", null, 1, null, null, null, null);
    ReflectionTestUtils.setField(existingIntent, "id", 55L);

    given(domainPackVersionRepository.findById(101L)).willReturn(Optional.of(version));
    given(
            policyDefinitionRepository.findExistingPolicyCodesByVersionIdAndCodes(
                101L, Set.of("refund_policy_default")))
        .willReturn(Set.of());
    given(intentDefinitionRepository.findByDomainPackVersionId(101L))
        .willReturn(List.of(existingIntent));
    given(slotDefinitionRepository.saveAll(any())).willAnswer(this::saveAllWithIds);
    given(policyDefinitionRepository.saveAll(any())).willAnswer(this::saveAllWithIds);
    given(riskDefinitionRepository.saveAll(any())).willAnswer(this::saveAllWithIds);
    given(workflowDefinitionRepository.saveAll(any())).willAnswer(this::saveAllWithIds);
    given(intentSlotBindingRepository.saveAll(any())).willAnswer(this::saveAllWithIds);
    given(intentWorkflowBindingRepository.saveAll(any())).willAnswer(this::saveAllWithIds);

    AddWorkflowDraftToVersionResult result =
        service.persistWorkflowDraft(
            101L,
            List.of(
                new AddWorkflowDraftToVersionCommand.SlotDraft(
                    "order_id", "주문번호", null, "STRING", false, null, null, null)),
            List.of(
                new AddWorkflowDraftToVersionCommand.PolicyDraft(
                    "refund_policy_default", "기본 환불 정책", null, "HIGH", null, null, null, null)),
            List.of(
                new AddWorkflowDraftToVersionCommand.RiskDraft(
                    "fraud_high_amount", "고액 사기 위험", null, "HIGH", null, null, null, null)),
            List.of(validWorkflowDraft("refund_policy_default")),
            List.of(
                new AddWorkflowDraftToVersionCommand.IntentSlotBindingDraft(
                    "refund_request", "order_id", true, 1, "주문번호를 알려주세요.", null)),
            List.of(
                new AddWorkflowDraftToVersionCommand.IntentWorkflowBindingDraft(
                    "refund_request", "refund_flow", true, null)));

    assertThat(result.domainPackId()).isEqualTo(7L);
    assertThat(result.addedSlotCount()).isEqualTo(1);
    assertThat(result.addedPolicyCount()).isEqualTo(1);
    assertThat(result.addedRiskCount()).isEqualTo(1);
    assertThat(result.addedWorkflowCount()).isEqualTo(1);
    assertThat(result.addedIntentSlotBindingCount()).isEqualTo(1);
    assertThat(result.addedIntentWorkflowBindingCount()).isEqualTo(1);
    verify(intentDefinitionRepository, never()).saveAllAndFlush(any());
  }

  @Test
  @DisplayName("workflow policyRef는 같은 version의 기존 DB policy로 해소할 수 있다")
  void persistWorkflowDraft_resolvesPolicyRefFromExistingVersionData() {
    DomainPackVersion version =
        DomainPackVersion.ofForTest(101L, 7L, DomainPackVersion.STATUS_DRAFT);
    given(domainPackVersionRepository.findById(101L)).willReturn(Optional.of(version));
    given(
            policyDefinitionRepository.findExistingPolicyCodesByVersionIdAndCodes(
                101L, Set.of("existing_policy")))
        .willReturn(Set.of("existing_policy"));
    given(intentDefinitionRepository.findByDomainPackVersionId(101L)).willReturn(List.of());
    given(slotDefinitionRepository.saveAll(any())).willAnswer(this::saveAllWithIds);
    given(policyDefinitionRepository.saveAll(any())).willAnswer(this::saveAllWithIds);
    given(riskDefinitionRepository.saveAll(any())).willAnswer(this::saveAllWithIds);
    given(workflowDefinitionRepository.saveAll(any())).willAnswer(this::saveAllWithIds);
    given(intentSlotBindingRepository.saveAll(any())).willAnswer(this::saveAllWithIds);
    given(intentWorkflowBindingRepository.saveAll(any())).willAnswer(this::saveAllWithIds);

    AddWorkflowDraftToVersionResult result =
        service.persistWorkflowDraft(
            101L,
            List.of(),
            List.of(),
            List.of(),
            List.of(validWorkflowDraft("existing_policy")),
            List.of(),
            List.of());

    assertThat(result.addedPolicyCount()).isZero();
    assertThat(result.addedWorkflowCount()).isEqualTo(1);
  }

  @Test
  @DisplayName("workflow policyRef가 callback과 DB 어디에도 없으면 예외를 던진다")
  void persistWorkflowDraft_missingPolicyRef_throws() {
    DomainPackVersion version =
        DomainPackVersion.ofForTest(101L, 7L, DomainPackVersion.STATUS_DRAFT);
    given(domainPackVersionRepository.findById(101L)).willReturn(Optional.of(version));
    given(
            policyDefinitionRepository.findExistingPolicyCodesByVersionIdAndCodes(
                101L, Set.of("missing_policy")))
        .willReturn(Set.of());

    assertThatThrownBy(
            () ->
                service.persistWorkflowDraft(
                    101L,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(validWorkflowDraft("missing_policy")),
                    List.of(),
                    List.of()))
        .isInstanceOf(WorkflowActionNodePolicyRefNotFoundException.class);
  }

  @Test
  @DisplayName("intent binding이 기존 intent를 찾지 못하면 invalid request 예외를 던진다")
  void persistWorkflowDraft_missingIntent_throws() {
    DomainPackVersion version =
        DomainPackVersion.ofForTest(101L, 7L, DomainPackVersion.STATUS_DRAFT);
    given(domainPackVersionRepository.findById(101L)).willReturn(Optional.of(version));
    given(
            policyDefinitionRepository.findExistingPolicyCodesByVersionIdAndCodes(
                101L, Set.of("refund_policy_default")))
        .willReturn(Set.of());
    given(intentDefinitionRepository.findByDomainPackVersionId(101L)).willReturn(List.of());
    given(slotDefinitionRepository.saveAll(any())).willAnswer(this::saveAllWithIds);
    given(policyDefinitionRepository.saveAll(any())).willAnswer(this::saveAllWithIds);
    given(riskDefinitionRepository.saveAll(any())).willAnswer(this::saveAllWithIds);
    given(workflowDefinitionRepository.saveAll(any())).willAnswer(this::saveAllWithIds);

    assertThatThrownBy(
            () ->
                service.persistWorkflowDraft(
                    101L,
                    List.of(
                        new AddWorkflowDraftToVersionCommand.SlotDraft(
                            "order_id", "주문번호", null, "STRING", false, null, null, null)),
                    List.of(
                        new AddWorkflowDraftToVersionCommand.PolicyDraft(
                            "refund_policy_default",
                            "기본 환불 정책",
                            null,
                            "HIGH",
                            null,
                            null,
                            null,
                            null)),
                    List.of(),
                    List.of(validWorkflowDraft("refund_policy_default")),
                    List.of(
                        new AddWorkflowDraftToVersionCommand.IntentSlotBindingDraft(
                            "missing_intent", "order_id", true, 1, null, null)),
                    List.of()))
        .isInstanceOf(
            com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException.class);
  }

  private AddWorkflowDraftToVersionCommand.WorkflowDraft validWorkflowDraft(String policyRef) {
    String graphJson =
        """
        {"nodes":[{"id":"start","type":"START"},{"id":"answer","type":"ACTION","policyRef":"%s"},{"id":"terminal","type":"TERMINAL"}],"edges":[{"id":"e1","from":"start","to":"answer"},{"id":"e2","from":"answer","to":"terminal"}]}
        """
            .formatted(policyRef);
    return new AddWorkflowDraftToVersionCommand.WorkflowDraft(
        "refund_flow", "환불 플로우", null, graphJson, null, null);
  }

  @SuppressWarnings("unchecked")
  private <T> List<T> saveAllWithIds(InvocationOnMock invocation) {
    Iterable<T> entities = invocation.getArgument(0);
    List<T> saved = new ArrayList<>();
    long id = 1L;
    for (T entity : entities) {
      if (hasIdField(entity)) {
        ReflectionTestUtils.setField(entity, "id", id++);
      }
      saved.add(entity);
    }
    return saved;
  }

  private boolean hasIdField(Object entity) {
    return entity instanceof SlotDefinition
        || entity instanceof PolicyDefinition
        || entity instanceof RiskDefinition
        || entity instanceof WorkflowDefinition
        || entity instanceof IntentSlotBinding
        || entity instanceof IntentWorkflowBinding;
  }
}
