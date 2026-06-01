package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.exception.DomainPackDraftAlreadyExistsException;
import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import com.init.domainpack.application.exception.DomainPackVersionCloneFailedException;
import com.init.domainpack.application.exception.DomainPackVersionConflictException;
import com.init.domainpack.domain.model.DomainPack;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("DomainPackVersionCloneService")
class DomainPackVersionCloneServiceTest {

  @Mock private DomainPackRepository domainPackRepository;
  @Mock private DomainPackVersionRepository versionRepository;
  @Mock private IntentDefinitionRepository intentRepository;
  @Mock private SlotDefinitionRepository slotRepository;
  @Mock private PolicyDefinitionRepository policyRepository;
  @Mock private RiskDefinitionRepository riskRepository;
  @Mock private WorkflowDefinitionRepository workflowRepository;
  @Mock private IntentSlotBindingRepository intentSlotBindingRepository;

  private DomainPackVersionCloneService service;

  @BeforeEach
  void setUp() {
    service =
        new DomainPackVersionCloneService(
            domainPackRepository,
            versionRepository,
            intentRepository,
            slotRepository,
            policyRepository,
            riskRepository,
            workflowRepository,
            intentSlotBindingRepository,
            new ObjectMapper());
  }

  @Test
  @DisplayName("PUBLISHED version의 정의와 binding을 새 DRAFT version으로 복제한다")
  void cloneVersion_copiesDefinitionsAndBindings() {
    DomainPackVersion baseVersion =
        version(100L, 7L, 2, DomainPackVersion.STATUS_PUBLISHED, "{\"origin\":\"manual\"}");
    IntentDefinition parent = intent(11L, 100L, "refund", "환불", null);
    IntentDefinition child = intent(12L, 100L, "refund_cancel", "환불 취소", 11L);
    SlotDefinition slot = slot(21L, 100L, "order_id");
    PolicyDefinition policy = policy(31L, 100L, "refund_policy");
    RiskDefinition risk = risk(41L, 100L, "fraud_risk");
    WorkflowDefinition workflow = workflow(51L, 100L, "refund_flow");
    IntentSlotBinding slotBinding =
        IntentSlotBinding.create(12L, 21L, true, 1, "주문번호", "{\"required\":true}");

    given(domainPackRepository.findByIdAndWorkspaceIdForUpdate(7L, 1L))
        .willReturn(Optional.of(DomainPack.create(1L, "cs", "CS", null, 10L)));
    given(
            versionRepository.existsByDomainPackIdAndLifecycleStatus(
                7L, DomainPackVersion.STATUS_DRAFT))
        .willReturn(false);
    given(versionRepository.findMaxVersionNoByDomainPackId(7L)).willReturn(Optional.of(2));
    given(versionRepository.saveAndFlush(any(DomainPackVersion.class)))
        .willAnswer(
            invocation -> {
              DomainPackVersion draft = invocation.getArgument(0);
              ReflectionTestUtils.setField(draft, "id", 200L);
              return draft;
            });
    given(
            intentRepository.findByDomainPackVersionIdAndStatus(
                100L, IntentDefinition.STATUS_PUBLISHED))
        .willReturn(List.of(parent, child));
    given(slotRepository.findAllByDomainPackVersionIdOrderBySlotCodeAsc(100L))
        .willReturn(List.of(slot));
    given(policyRepository.findAllByDomainPackVersionIdOrderByPolicyCodeAsc(100L))
        .willReturn(List.of(policy));
    given(riskRepository.findAllByDomainPackVersionIdOrderByRiskCodeAsc(100L))
        .willReturn(List.of(risk));
    given(workflowRepository.findAllByDomainPackVersionId(100L)).willReturn(List.of(workflow));
    given(intentRepository.saveAllAndFlush(any()))
        .willAnswer(invocation -> assignIntentIds(invocation.getArgument(0)));
    given(slotRepository.saveAllAndFlush(any()))
        .willAnswer(invocation -> assignSlotIds(invocation.getArgument(0)));
    given(policyRepository.saveAllAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(riskRepository.saveAllAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(workflowRepository.saveAllAndFlush(any()))
        .willAnswer(invocation -> assignWorkflowIds(invocation.getArgument(0)));
    given(intentSlotBindingRepository.findAllByIntentDefinitionIdIn(List.of(11L, 12L)))
        .willReturn(List.of(slotBinding));
    given(intentSlotBindingRepository.saveAllAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));

    DomainPackVersionCloneResult result =
        service.cloneVersion(
            new DomainPackVersionCloneCommand(
                1L, 7L, baseVersion, 10L, DomainPackDraftSourceType.INTENT_REVISION, "보정"));

    assertThat(result.draftVersionId()).isEqualTo(200L);
    assertThat(result.draftVersionNo()).isEqualTo(3);
    assertThat(result.sourceType()).isEqualTo(DomainPackDraftSourceType.INTENT_REVISION);
    assertThat(result.baseVersionId()).isEqualTo(100L);

    // clone reason은 새 draft version의 description(commit-log 성격)으로 영속화된다.
    ArgumentCaptor<DomainPackVersion> savedVersion =
        ArgumentCaptor.forClass(DomainPackVersion.class);
    verify(versionRepository).saveAndFlush(savedVersion.capture());
    assertThat(savedVersion.getValue().getDescription()).isEqualTo("보정");

    ArgumentCaptor<Iterable<IntentSlotBinding>> slotBindings =
        ArgumentCaptor.forClass(Iterable.class);
    verify(intentSlotBindingRepository).saveAllAndFlush(slotBindings.capture());
    IntentSlotBinding copiedSlotBinding = slotBindings.getValue().iterator().next();
    assertThat(copiedSlotBinding.getIntentDefinitionId()).isEqualTo(112L);
    assertThat(copiedSlotBinding.getSlotDefinitionId()).isEqualTo(121L);

    // Workflow는 이제 intent_definition_id FK를 직접 소유하므로
    // workflowRepository.saveAllAndFlush에서 intent remapping이 적용됐는지 검증한다.
    @SuppressWarnings("unchecked")
    ArgumentCaptor<Iterable<WorkflowDefinition>> copiedWorkflows =
        ArgumentCaptor.forClass(Iterable.class);
    verify(workflowRepository).saveAllAndFlush(copiedWorkflows.capture());
    WorkflowDefinition copiedWorkflow = copiedWorkflows.getValue().iterator().next();
    assertThat(copiedWorkflow.getIntentDefinitionId()).isEqualTo(112L);
  }

  @Test
  @DisplayName("정의 복제 중 DB 오류는 DomainPackVersionCloneFailedException으로 변환한다")
  void cloneVersion_whenComponentCloneFails_throwsCloneFailed() {
    DomainPackVersion baseVersion =
        version(100L, 7L, 2, DomainPackVersion.STATUS_PUBLISHED, "{\"origin\":\"manual\"}");
    IntentDefinition intent = intent(11L, 100L, "refund", "환불", null);

    given(domainPackRepository.findByIdAndWorkspaceIdForUpdate(7L, 1L))
        .willReturn(Optional.of(DomainPack.create(1L, "cs", "CS", null, 10L)));
    given(
            versionRepository.existsByDomainPackIdAndLifecycleStatus(
                7L, DomainPackVersion.STATUS_DRAFT))
        .willReturn(false);
    given(versionRepository.findMaxVersionNoByDomainPackId(7L)).willReturn(Optional.of(2));
    given(versionRepository.saveAndFlush(any(DomainPackVersion.class)))
        .willAnswer(
            invocation -> {
              DomainPackVersion draft = invocation.getArgument(0);
              ReflectionTestUtils.setField(draft, "id", 200L);
              return draft;
            });
    given(
            intentRepository.findByDomainPackVersionIdAndStatus(
                100L, IntentDefinition.STATUS_PUBLISHED))
        .willReturn(List.of(intent));
    given(slotRepository.findAllByDomainPackVersionIdOrderBySlotCodeAsc(100L))
        .willReturn(List.of());
    given(policyRepository.findAllByDomainPackVersionIdOrderByPolicyCodeAsc(100L))
        .willReturn(List.of());
    given(riskRepository.findAllByDomainPackVersionIdOrderByRiskCodeAsc(100L))
        .willReturn(List.of());
    given(workflowRepository.findAllByDomainPackVersionId(100L)).willReturn(List.of());
    given(intentRepository.saveAllAndFlush(any()))
        .willThrow(new DataIntegrityViolationException("duplicate intent"));

    assertThatThrownBy(
            () ->
                service.cloneVersion(
                    new DomainPackVersionCloneCommand(
                        1L, 7L, baseVersion, 10L, DomainPackDraftSourceType.INTENT_REVISION, "보정")))
        .isInstanceOf(DomainPackVersionCloneFailedException.class)
        .hasCauseInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  @DisplayName("이미 DRAFT version이 있으면 새 draft 생성을 거부한다")
  void createEmptyDraft_whenDraftExists_throws() {
    given(domainPackRepository.findByIdAndWorkspaceIdForUpdate(7L, 1L))
        .willReturn(Optional.of(DomainPack.create(1L, "cs", "CS", null, 10L)));
    given(
            versionRepository.existsByDomainPackIdAndLifecycleStatus(
                7L, DomainPackVersion.STATUS_DRAFT))
        .willReturn(true);

    assertThatThrownBy(
            () ->
                service.createEmptyDraft(
                    new DomainPackVersionCreateCommand(1L, 7L, 10L, null, "{}")))
        .isInstanceOf(DomainPackDraftAlreadyExistsException.class);
  }

  @Test
  @DisplayName("createEmptyDraft: 사유 없는 빈 DRAFT는 description이 null이다")
  void createEmptyDraft_createsDraftWithoutDescription() {
    given(domainPackRepository.findByIdAndWorkspaceIdForUpdate(7L, 1L))
        .willReturn(Optional.of(DomainPack.create(1L, "cs", "CS", null, 10L)));
    given(
            versionRepository.existsByDomainPackIdAndLifecycleStatus(
                7L, DomainPackVersion.STATUS_DRAFT))
        .willReturn(false);
    given(versionRepository.findMaxVersionNoByDomainPackId(7L)).willReturn(Optional.of(2));
    given(versionRepository.saveAndFlush(any(DomainPackVersion.class)))
        .willAnswer(
            invocation -> {
              DomainPackVersion draft = invocation.getArgument(0);
              ReflectionTestUtils.setField(draft, "id", 200L);
              return draft;
            });

    DomainPackVersion result =
        service.createEmptyDraft(new DomainPackVersionCreateCommand(1L, 7L, 10L, null, "{}"));

    assertThat(result.getDescription()).isNull();
    assertThat(result.getVersionNo()).isEqualTo(3);
  }

  @Test
  @DisplayName("저장 충돌은 DomainPackVersionConflictException으로 변환한다")
  void createEmptyDraft_whenSaveConflicts_throwsConflict() {
    given(domainPackRepository.findByIdAndWorkspaceIdForUpdate(7L, 1L))
        .willReturn(Optional.of(DomainPack.create(1L, "cs", "CS", null, 10L)));
    given(
            versionRepository.existsByDomainPackIdAndLifecycleStatus(
                7L, DomainPackVersion.STATUS_DRAFT))
        .willReturn(false);
    given(versionRepository.findMaxVersionNoByDomainPackId(7L)).willReturn(Optional.of(2));
    given(versionRepository.saveAndFlush(any(DomainPackVersion.class)))
        .willThrow(new DataIntegrityViolationException("duplicate"));

    assertThatThrownBy(
            () ->
                service.createEmptyDraft(
                    new DomainPackVersionCreateCommand(1L, 7L, 10L, null, "{}")))
        .isInstanceOf(DomainPackVersionConflictException.class);
  }

  @Test
  @DisplayName("summaryJson이 object가 아니면 draft source를 만들 수 없다")
  void cloneVersion_whenSummaryIsNotObject_throws() {
    DomainPackVersion baseVersion = version(100L, 7L, 2, DomainPackVersion.STATUS_PUBLISHED, "[]");
    given(domainPackRepository.findByIdAndWorkspaceIdForUpdate(7L, 1L))
        .willReturn(Optional.of(DomainPack.create(1L, "cs", "CS", null, 10L)));
    given(
            versionRepository.existsByDomainPackIdAndLifecycleStatus(
                7L, DomainPackVersion.STATUS_DRAFT))
        .willReturn(false);
    given(versionRepository.findMaxVersionNoByDomainPackId(7L)).willReturn(Optional.of(2));

    assertThatThrownBy(
            () ->
                service.cloneVersion(
                    new DomainPackVersionCloneCommand(
                        1L, 7L, baseVersion, 10L, DomainPackDraftSourceType.RESTORE, null)))
        .isInstanceOf(DomainPackDraftRequestInvalidException.class);
  }

  private List<IntentDefinition> assignIntentIds(Iterable<IntentDefinition> values) {
    List<IntentDefinition> intents = new java.util.ArrayList<>();
    values.forEach(intents::add);
    for (IntentDefinition intent : intents) {
      if ("refund".equals(intent.getIntentCode())) {
        ReflectionTestUtils.setField(intent, "id", 111L);
      }
      if ("refund_cancel".equals(intent.getIntentCode())) {
        ReflectionTestUtils.setField(intent, "id", 112L);
      }
    }
    return intents;
  }

  private List<SlotDefinition> assignSlotIds(List<SlotDefinition> slots) {
    ReflectionTestUtils.setField(slots.getFirst(), "id", 121L);
    return slots;
  }

  private List<WorkflowDefinition> assignWorkflowIds(List<WorkflowDefinition> workflows) {
    ReflectionTestUtils.setField(workflows.getFirst(), "id", 151L);
    return workflows;
  }

  private DomainPackVersion version(
      Long id, Long packId, Integer versionNo, String status, String summaryJson) {
    DomainPackVersion version = DomainPackVersion.ofForTest(id, packId, status);
    ReflectionTestUtils.setField(version, "versionNo", versionNo);
    ReflectionTestUtils.setField(version, "summaryJson", summaryJson);
    return version;
  }

  private IntentDefinition intent(
      Long id, Long versionId, String code, String name, Long parentIntentId) {
    IntentDefinition intent =
        IntentDefinition.create(versionId, code, name, null, 1, "{}", "{}", "[]", "{}");
    ReflectionTestUtils.setField(intent, "id", id);
    ReflectionTestUtils.setField(intent, "status", IntentDefinition.STATUS_PUBLISHED);
    ReflectionTestUtils.setField(intent, "parentIntentId", parentIntentId);
    return intent;
  }

  private SlotDefinition slot(Long id, Long versionId, String code) {
    SlotDefinition slot =
        SlotDefinition.create(versionId, code, "주문번호", null, "STRING", false, "{}", null, "{}");
    ReflectionTestUtils.setField(slot, "id", id);
    return slot;
  }

  private PolicyDefinition policy(Long id, Long versionId, String code) {
    PolicyDefinition policy =
        PolicyDefinition.create(versionId, code, "정책", null, "HIGH", "{}", "{}", "[]", "{}");
    ReflectionTestUtils.setField(policy, "id", id);
    return policy;
  }

  private RiskDefinition risk(Long id, Long versionId, String code) {
    RiskDefinition risk =
        RiskDefinition.create(versionId, code, "위험", null, "HIGH", "{}", "{}", "[]", "{}");
    ReflectionTestUtils.setField(risk, "id", id);
    return risk;
  }

  private WorkflowDefinition workflow(Long id, Long versionId, String code) {
    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            versionId, code, "워크플로우", null, "{}", "start", "[]", "[]", "{}", 12L, true, "{}");
    ReflectionTestUtils.setField(workflow, "id", id);
    return workflow;
  }
}
