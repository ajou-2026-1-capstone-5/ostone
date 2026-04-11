package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import com.init.domainpack.infrastructure.persistence.JpaIntentDefinitionRepository;
import com.init.domainpack.infrastructure.persistence.JpaIntentSlotBindingRepository;
import com.init.domainpack.infrastructure.persistence.JpaIntentWorkflowBindingRepository;
import com.init.domainpack.infrastructure.persistence.JpaPolicyDefinitionRepository;
import com.init.domainpack.infrastructure.persistence.JpaRiskDefinitionRepository;
import com.init.domainpack.infrastructure.persistence.JpaSlotDefinitionRepository;
import com.init.domainpack.infrastructure.persistence.JpaWorkflowDefinitionRepository;
import java.lang.reflect.Constructor;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("CreateDomainPackDraftUseCase")
class CreateDomainPackDraftUseCaseTest {

  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private JpaIntentDefinitionRepository intentDefinitionRepository;
  @Mock private JpaSlotDefinitionRepository slotDefinitionRepository;
  @Mock private JpaPolicyDefinitionRepository policyDefinitionRepository;
  @Mock private JpaRiskDefinitionRepository riskDefinitionRepository;
  @Mock private JpaWorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock private JpaIntentSlotBindingRepository intentSlotBindingRepository;
  @Mock private JpaIntentWorkflowBindingRepository intentWorkflowBindingRepository;
  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;

  private CreateDomainPackDraftUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new CreateDomainPackDraftUseCase(
            domainPackVersionRepository,
            domainPackRepository,
            intentDefinitionRepository,
            slotDefinitionRepository,
            policyDefinitionRepository,
            riskDefinitionRepository,
            workflowDefinitionRepository,
            intentSlotBindingRepository,
            intentWorkflowBindingRepository,
            workspaceExistencePort,
            workspaceMembershipPort);
  }

  @Test
  @DisplayName("정상 생성 시 새 DRAFT 버전과 하위 정의를 저장한다")
  void execute_validCommand_returnsCreatedDraft() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(7L, 1L)).willReturn(true);
    given(domainPackVersionRepository.findMaxVersionNoByDomainPackId(7L))
        .willReturn(Optional.of(2));
    given(domainPackVersionRepository.saveAndFlush(any()))
        .willAnswer(invocation -> createSavedVersion(101L, 7L, 3));
    given(intentDefinitionRepository.saveAll(any()))
        .willAnswer(
            invocation -> assignIntentIds(invocation.getArgument(0), List.of(1001L, 1002L)));
    given(slotDefinitionRepository.saveAll(any()))
        .willAnswer(invocation -> assignSlotIds(invocation.getArgument(0), List.of(2001L)));
    given(policyDefinitionRepository.saveAll(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(riskDefinitionRepository.saveAll(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(workflowDefinitionRepository.saveAll(any()))
        .willAnswer(invocation -> assignWorkflowIds(invocation.getArgument(0), List.of(3001L)));
    given(intentSlotBindingRepository.saveAll(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(intentWorkflowBindingRepository.saveAll(any()))
        .willAnswer(invocation -> invocation.getArgument(0));

    CreateDomainPackDraftResult result = useCase.execute(validCommand());

    assertThat(result.versionId()).isEqualTo(101L);
    assertThat(result.domainPackId()).isEqualTo(7L);
    assertThat(result.versionNo()).isEqualTo(3);
    assertThat(result.lifecycleStatus()).isEqualTo(DomainPackVersion.STATUS_DRAFT);
    assertThat(result.intentCount()).isEqualTo(2);
    assertThat(result.slotCount()).isEqualTo(1);
    assertThat(result.workflowCount()).isEqualTo(1);
    verify(intentSlotBindingRepository).saveAll(any());
    verify(intentWorkflowBindingRepository).saveAll(any());
  }

  @Test
  @DisplayName("workspace가 없으면 예외를 던지고 저장하지 않는다")
  void execute_workspaceNotFound_throwsException() {
    given(workspaceExistencePort.existsById(1L)).willReturn(false);

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);

    verify(domainPackVersionRepository, never()).saveAndFlush(any());
  }

  @Test
  @DisplayName("domain pack이 workspace에 없으면 예외를 던진다")
  void execute_domainPackNotFound_throwsException() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(7L, 1L)).willReturn(false);

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(DomainPackNotFoundException.class);
  }

  @Test
  @DisplayName("존재하지 않는 참조 코드가 있으면 예외를 던진다")
  void execute_missingBindingReference_throwsException() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(7L, 1L)).willReturn(true);
    given(domainPackVersionRepository.findMaxVersionNoByDomainPackId(7L))
        .willReturn(Optional.empty());
    given(domainPackVersionRepository.saveAndFlush(any()))
        .willAnswer(invocation -> createSavedVersion(101L, 7L, 1));
    given(intentDefinitionRepository.saveAll(any()))
        .willAnswer(invocation -> assignIntentIds(invocation.getArgument(0), List.of(1001L)));
    given(slotDefinitionRepository.saveAll(any())).willAnswer(invocation -> List.of());
    given(policyDefinitionRepository.saveAll(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(riskDefinitionRepository.saveAll(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(workflowDefinitionRepository.saveAll(any())).willAnswer(invocation -> List.of());

    CreateDomainPackDraftCommand command =
        new CreateDomainPackDraftCommand(
            1L,
            7L,
            10L,
            null,
            "{}",
            List.of(
                new CreateDomainPackDraftCommand.IntentDraft(
                    "refund_request", "환불 요청", null, 1, null, null, null, null, null)),
            List.of(),
            List.of(
                new CreateDomainPackDraftCommand.IntentSlotBindingDraft(
                    "refund_request", "missing_slot", true, 1, null, null)),
            List.of(),
            List.of(),
            List.of(),
            List.of());

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(DomainPackDraftRequestInvalidException.class)
        .hasMessageContaining("slot 참조를 찾을 수 없습니다");
  }

  private CreateDomainPackDraftCommand validCommand() {
    return new CreateDomainPackDraftCommand(
        1L,
        7L,
        10L,
        55L,
        "{\"summary\":\"draft\"}",
        List.of(
            new CreateDomainPackDraftCommand.IntentDraft(
                "refund_request", "환불 요청", "환불 문의", 1, null, null, null, null, null),
            new CreateDomainPackDraftCommand.IntentDraft(
                "refund_request_cancel",
                "환불 요청 취소",
                null,
                2,
                "refund_request",
                null,
                null,
                null,
                null)),
        List.of(
            new CreateDomainPackDraftCommand.SlotDraft(
                "order_id", "주문 번호", null, "STRING", false, null, null, null)),
        List.of(
            new CreateDomainPackDraftCommand.IntentSlotBindingDraft(
                "refund_request", "order_id", true, 1, "주문번호를 알려주세요", null)),
        List.of(),
        List.of(),
        List.of(
            new CreateDomainPackDraftCommand.WorkflowDraft(
                "refund_flow",
                "환불 플로우",
                null,
                "{\"nodes\":[]}",
                "START",
                "[\"DONE\"]",
                null,
                null)),
        List.of(
            new CreateDomainPackDraftCommand.IntentWorkflowBindingDraft(
                "refund_request", "refund_flow", true, null)));
  }

  private DomainPackVersion createSavedVersion(Long id, Long packId, Integer versionNo) {
    DomainPackVersion version = newVersion();
    ReflectionTestUtils.setField(version, "id", id);
    ReflectionTestUtils.setField(version, "domainPackId", packId);
    ReflectionTestUtils.setField(version, "versionNo", versionNo);
    ReflectionTestUtils.setField(version, "lifecycleStatus", DomainPackVersion.STATUS_DRAFT);
    ReflectionTestUtils.setField(version, "sourcePipelineJobId", 55L);
    ReflectionTestUtils.setField(
        version, "createdAt", OffsetDateTime.parse("2026-04-10T09:00:00Z"));
    return version;
  }

  private DomainPackVersion newVersion() {
    try {
      Constructor<DomainPackVersion> constructor = DomainPackVersion.class.getDeclaredConstructor();
      constructor.setAccessible(true);
      return constructor.newInstance();
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  @SuppressWarnings("unchecked")
  private List<IntentDefinition> assignIntentIds(List<IntentDefinition> intents, List<Long> ids) {
    for (int i = 0; i < intents.size(); i++) {
      ReflectionTestUtils.setField(intents.get(i), "id", ids.get(i));
    }
    return intents;
  }

  private List<SlotDefinition> assignSlotIds(List<SlotDefinition> slots, List<Long> ids) {
    for (int i = 0; i < slots.size(); i++) {
      ReflectionTestUtils.setField(slots.get(i), "id", ids.get(i));
    }
    return slots;
  }

  private List<WorkflowDefinition> assignWorkflowIds(
      List<WorkflowDefinition> workflows, List<Long> ids) {
    for (int i = 0; i < workflows.size(); i++) {
      ReflectionTestUtils.setField(workflows.get(i), "id", ids.get(i));
    }
    return workflows;
  }
}
