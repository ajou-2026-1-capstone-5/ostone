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
import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefInvalidCharsException;
import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefMissingException;
import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefNotFoundException;
import com.init.domainpack.application.exception.WorkflowCycleDetectedException;
import com.init.domainpack.application.exception.WorkflowDanglingEdgeException;
import com.init.domainpack.application.exception.WorkflowEdgeIdDuplicateException;
import com.init.domainpack.application.exception.WorkflowEdgeIdMissingException;
import com.init.domainpack.application.exception.WorkflowInvalidStartNodeException;
import com.init.domainpack.application.exception.WorkflowInvalidTerminalNodeException;
import com.init.domainpack.application.exception.WorkflowUnlabeledBranchException;
import com.init.domainpack.application.exception.WorkflowUnreachableNodeException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.IntentWorkflowBindingRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
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

  // START→ACTION→TERMINAL, 사이클 없음, 유효한 V1-V8 그래프
  private static final String VALID_GRAPH_JSON =
      "{\"direction\":\"LR\","
          + "\"nodes\":["
          + "{\"id\":\"start\",\"label\":\"시작\",\"type\":\"START\"},"
          + "{\"id\":\"action1\",\"label\":\"처리\",\"type\":\"ACTION\",\"policyRef\":\"handle_policy\"},"
          + "{\"id\":\"terminal\",\"label\":\"종료\",\"type\":\"TERMINAL\"}"
          + "],"
          + "\"edges\":["
          + "{\"id\":\"e_start_to_action1\",\"from\":\"start\",\"to\":\"action1\"},"
          + "{\"id\":\"e_action1_to_terminal\",\"from\":\"action1\",\"to\":\"terminal\"}"
          + "]}";

  // DECISION 노드 포함 유효한 그래프 (label 있음)
  private static final String VALID_GRAPH_WITH_DECISION =
      "{\"direction\":\"LR\","
          + "\"nodes\":["
          + "{\"id\":\"start\",\"label\":\"시작\",\"type\":\"START\"},"
          + "{\"id\":\"dec\",\"label\":\"분기\",\"type\":\"DECISION\"},"
          + "{\"id\":\"t1\",\"label\":\"종료1\",\"type\":\"TERMINAL\"},"
          + "{\"id\":\"t2\",\"label\":\"종료2\",\"type\":\"TERMINAL\"}"
          + "],"
          + "\"edges\":["
          + "{\"id\":\"e_start_to_dec\",\"from\":\"start\",\"to\":\"dec\"},"
          + "{\"id\":\"e_dec_to_t1\",\"from\":\"dec\",\"to\":\"t1\",\"label\":\"yes\"},"
          + "{\"id\":\"e_dec_to_t2\",\"from\":\"dec\",\"to\":\"t2\",\"label\":\"no\"}"
          + "]}";

  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;
  @Mock private SlotDefinitionRepository slotDefinitionRepository;
  @Mock private PolicyDefinitionRepository policyDefinitionRepository;
  @Mock private RiskDefinitionRepository riskDefinitionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock private IntentSlotBindingRepository intentSlotBindingRepository;
  @Mock private IntentWorkflowBindingRepository intentWorkflowBindingRepository;
  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;

  private CreateDomainPackDraftUseCase useCase;
  private DomainPackDraftPersistenceService domainPackDraftPersistenceService;

  @BeforeEach
  void setUp() {
    domainPackDraftPersistenceService =
        new DomainPackDraftPersistenceService(
            domainPackVersionRepository,
            intentDefinitionRepository,
            slotDefinitionRepository,
            policyDefinitionRepository,
            riskDefinitionRepository,
            workflowDefinitionRepository,
            intentSlotBindingRepository,
            intentWorkflowBindingRepository);
    useCase =
        new CreateDomainPackDraftUseCase(
            domainPackRepository,
            workspaceExistencePort,
            workspaceMembershipPort,
            domainPackDraftPersistenceService);
  }

  @Test
  @DisplayName("정상 생성 시 새 DRAFT 버전과 하위 정의를 저장한다")
  void should_saveNewDraftVersionAndDefinitions_when_validCommand() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(7L, 1L)).willReturn(true);
    given(domainPackVersionRepository.findMaxVersionNoByDomainPackId(7L))
        .willReturn(Optional.of(2));
    given(domainPackVersionRepository.saveAndFlush(any()))
        .willAnswer(invocation -> createSavedVersion(101L, 7L, 3));
    given(intentDefinitionRepository.saveAllAndFlush(any()))
        .willAnswer(invocation -> assignIntentIds(invocation.getArgument(0), List.of(1001L, 1002L)))
        .willAnswer(invocation -> invocation.getArgument(0));
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
  void should_throwWorkspaceNotFoundException_when_workspaceNotFound() {
    given(workspaceExistencePort.existsById(1L)).willReturn(false);

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);

    verify(domainPackVersionRepository, never()).saveAndFlush(any());
  }

  @Test
  @DisplayName("domain pack이 workspace에 없으면 예외를 던진다")
  void should_throwDomainPackNotFoundException_when_domainPackNotFound() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(7L, 1L)).willReturn(false);

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(DomainPackNotFoundException.class);
  }

  @Test
  @DisplayName("존재하지 않는 참조 코드가 있으면 예외를 던진다")
  void should_throwDraftRequestInvalidException_when_bindingReferenceNotFound() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(7L, 1L)).willReturn(true);
    given(domainPackVersionRepository.findMaxVersionNoByDomainPackId(7L))
        .willReturn(Optional.empty());
    given(domainPackVersionRepository.saveAndFlush(any()))
        .willAnswer(invocation -> createSavedVersion(101L, 7L, 1));
    given(intentDefinitionRepository.saveAllAndFlush(any()))
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
                new IntentDraft("refund_request", "환불 요청", null, 1, null, null, null, null, null)),
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

  // ──────────────────────────────────────────────────────────────
  // graphJson V1-V6 위반 테스트
  // ──────────────────────────────────────────────────────────────

  @Test
  @DisplayName("graphJson V1 위반 — START 노드 없으면 WorkflowInvalidStartNodeException")
  void should_throwInvalidStartNodeException_when_startNodeMissing() {
    stubWorkspaceAndPack();
    String noStart =
        "{\"direction\":\"LR\","
            + "\"nodes\":[{\"id\":\"terminal\",\"label\":\"종료\",\"type\":\"TERMINAL\"}],"
            + "\"edges\":[]}";
    assertThatThrownBy(() -> useCase.execute(commandWithGraphJson(noStart)))
        .isInstanceOf(WorkflowInvalidStartNodeException.class);
  }

  @Test
  @DisplayName("graphJson V1 위반 — START 노드 2개면 WorkflowInvalidStartNodeException")
  void should_throwInvalidStartNodeException_when_multipleStartNodes() {
    stubWorkspaceAndPack();
    String twoStart =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"s1\",\"label\":\"시작1\",\"type\":\"START\"},"
            + "{\"id\":\"s2\",\"label\":\"시작2\",\"type\":\"START\"},"
            + "{\"id\":\"t\",\"label\":\"종료\",\"type\":\"TERMINAL\"}"
            + "],"
            + "\"edges\":[{\"from\":\"s1\",\"to\":\"t\"},{\"from\":\"s2\",\"to\":\"t\"}]}";
    assertThatThrownBy(() -> useCase.execute(commandWithGraphJson(twoStart)))
        .isInstanceOf(WorkflowInvalidStartNodeException.class);
  }

  @Test
  @DisplayName("graphJson V2 위반 — TERMINAL 노드 없으면 WorkflowInvalidTerminalNodeException")
  void should_throwInvalidTerminalNodeException_when_terminalNodeMissing() {
    stubWorkspaceAndPack();
    String noTerminal =
        "{\"direction\":\"LR\","
            + "\"nodes\":[{\"id\":\"start\",\"label\":\"시작\",\"type\":\"START\"}],"
            + "\"edges\":[]}";
    assertThatThrownBy(() -> useCase.execute(commandWithGraphJson(noTerminal)))
        .isInstanceOf(WorkflowInvalidTerminalNodeException.class);
  }

  @Test
  @DisplayName("graphJson V3 위반 — 없는 노드 id 참조하면 WorkflowDanglingEdgeException")
  void should_throwDanglingEdgeException_when_edgeReferencesNonExistentNode() {
    stubWorkspaceAndPack();
    String dangling =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"label\":\"시작\",\"type\":\"START\"},"
            + "{\"id\":\"terminal\",\"label\":\"종료\",\"type\":\"TERMINAL\"}"
            + "],"
            + "\"edges\":[{\"from\":\"start\",\"to\":\"ghost\"}]}";
    assertThatThrownBy(() -> useCase.execute(commandWithGraphJson(dangling)))
        .isInstanceOf(WorkflowDanglingEdgeException.class);
  }

  @Test
  @DisplayName("graphJson V4 위반 — START에서 도달 불가 노드 있으면 WorkflowUnreachableNodeException")
  void should_throwUnreachableNodeException_when_nodeUnreachableFromStart() {
    stubWorkspaceAndPack();
    String unreachable =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"label\":\"시작\",\"type\":\"START\"},"
            + "{\"id\":\"terminal\",\"label\":\"종료\",\"type\":\"TERMINAL\"},"
            + "{\"id\":\"island\",\"label\":\"고립\",\"type\":\"ACTION\"}"
            + "],"
            + "\"edges\":[{\"from\":\"start\",\"to\":\"terminal\"}]}";
    assertThatThrownBy(() -> useCase.execute(commandWithGraphJson(unreachable)))
        .isInstanceOf(WorkflowUnreachableNodeException.class);
  }

  @Test
  @DisplayName("graphJson V5 위반 — 사이클 존재하면 WorkflowCycleDetectedException")
  void should_throwCycleDetectedException_when_cycleExists() {
    stubWorkspaceAndPack();
    String cycle =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"label\":\"시작\",\"type\":\"START\"},"
            + "{\"id\":\"a\",\"label\":\"A\",\"type\":\"ACTION\"},"
            + "{\"id\":\"b\",\"label\":\"B\",\"type\":\"ACTION\"},"
            + "{\"id\":\"terminal\",\"label\":\"종료\",\"type\":\"TERMINAL\"}"
            + "],"
            + "\"edges\":["
            + "{\"from\":\"start\",\"to\":\"a\"},"
            + "{\"from\":\"a\",\"to\":\"b\"},"
            + "{\"from\":\"b\",\"to\":\"a\"},"
            + "{\"from\":\"b\",\"to\":\"terminal\"}"
            + "]}";
    assertThatThrownBy(() -> useCase.execute(commandWithGraphJson(cycle)))
        .isInstanceOf(WorkflowCycleDetectedException.class);
  }

  @Test
  @DisplayName(
      "graphJson V6 위반 — DECISION outgoing edge에 label 없으면 WorkflowUnlabeledBranchException")
  void should_throwUnlabeledBranchException_when_decisionEdgeHasNoLabel() {
    stubWorkspaceAndPack();
    String unlabeled =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"label\":\"시작\",\"type\":\"START\"},"
            + "{\"id\":\"dec\",\"label\":\"분기\",\"type\":\"DECISION\"},"
            + "{\"id\":\"terminal\",\"label\":\"종료\",\"type\":\"TERMINAL\"}"
            + "],"
            + "\"edges\":["
            + "{\"from\":\"start\",\"to\":\"dec\"},"
            + "{\"from\":\"dec\",\"to\":\"terminal\"}"
            + "]}";
    assertThatThrownBy(() -> useCase.execute(commandWithGraphJson(unlabeled)))
        .isInstanceOf(WorkflowUnlabeledBranchException.class);
  }

  @Test
  @DisplayName("graphJson V7a 위반 — edge id 누락 시 WorkflowEdgeIdMissingException")
  void should_throwEdgeIdMissingException_when_edgeIdMissing() {
    stubWorkspaceAndPack();
    String missingEdgeIdGraph =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"label\":\"시작\",\"type\":\"START\"},"
            + "{\"id\":\"action1\",\"label\":\"처리\",\"type\":\"ACTION\"},"
            + "{\"id\":\"terminal\",\"label\":\"종료\",\"type\":\"TERMINAL\"}"
            + "],"
            + "\"edges\":["
            + "{\"from\":\"start\",\"to\":\"action1\"},"
            + "{\"id\":\"e_action1_to_terminal\",\"from\":\"action1\",\"to\":\"terminal\"}"
            + "]}";
    assertThatThrownBy(() -> useCase.execute(commandWithGraphJson(missingEdgeIdGraph)))
        .isInstanceOf(WorkflowEdgeIdMissingException.class);
  }

  @Test
  @DisplayName("graphJson V7a 위반 — edge id 공백 시 WorkflowEdgeIdMissingException")
  void should_throwEdgeIdMissingException_when_edgeIdBlank() {
    stubWorkspaceAndPack();
    String blankEdgeIdGraph =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"label\":\"시작\",\"type\":\"START\"},"
            + "{\"id\":\"action1\",\"label\":\"처리\",\"type\":\"ACTION\"},"
            + "{\"id\":\"terminal\",\"label\":\"종료\",\"type\":\"TERMINAL\"}"
            + "],"
            + "\"edges\":["
            + "{\"id\":\"   \",\"from\":\"start\",\"to\":\"action1\"},"
            + "{\"id\":\"e_action1_to_terminal\",\"from\":\"action1\",\"to\":\"terminal\"}"
            + "]}";
    assertThatThrownBy(() -> useCase.execute(commandWithGraphJson(blankEdgeIdGraph)))
        .isInstanceOf(WorkflowEdgeIdMissingException.class);
  }

  @Test
  @DisplayName("graphJson V7b 위반 — edge id 중복 시 WorkflowEdgeIdDuplicateException")
  void should_throwEdgeIdDuplicateException_when_edgeIdDuplicated() {
    stubWorkspaceAndPack();
    String duplicateEdgeIdGraph =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"label\":\"시작\",\"type\":\"START\"},"
            + "{\"id\":\"dec\",\"label\":\"분기\",\"type\":\"DECISION\"},"
            + "{\"id\":\"t1\",\"label\":\"종료1\",\"type\":\"TERMINAL\"},"
            + "{\"id\":\"t2\",\"label\":\"종료2\",\"type\":\"TERMINAL\"}"
            + "],"
            + "\"edges\":["
            + "{\"id\":\"dup\",\"from\":\"start\",\"to\":\"dec\"},"
            + "{\"id\":\"dup\",\"from\":\"dec\",\"to\":\"t1\",\"label\":\"yes\"},"
            + "{\"id\":\"e_dec_to_t2\",\"from\":\"dec\",\"to\":\"t2\",\"label\":\"no\"}"
            + "]}";
    assertThatThrownBy(() -> useCase.execute(commandWithGraphJson(duplicateEdgeIdGraph)))
        .isInstanceOf(WorkflowEdgeIdDuplicateException.class);
  }

  // ──────────────────────────────────────────────────────────────
  // graphJson V8 위반 테스트
  // ──────────────────────────────────────────────────────────────

  @Test
  @DisplayName(
      "graphJson V8a 위반 — ACTION 노드 policyRef 없으면 WorkflowActionNodePolicyRefMissingException")
  void should_throwPolicyRefMissingException_when_actionNodePolicyRefMissing() {
    stubWorkspaceAndPack();
    String missingPolicyRefGraph =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"label\":\"시작\",\"type\":\"START\"},"
            + "{\"id\":\"action1\",\"label\":\"처리\",\"type\":\"ACTION\"},"
            + "{\"id\":\"terminal\",\"label\":\"종료\",\"type\":\"TERMINAL\"}"
            + "],"
            + "\"edges\":["
            + "{\"id\":\"e1\",\"from\":\"start\",\"to\":\"action1\"},"
            + "{\"id\":\"e2\",\"from\":\"action1\",\"to\":\"terminal\"}"
            + "]}";
    assertThatThrownBy(() -> useCase.execute(commandWithGraphJson(missingPolicyRefGraph)))
        .isInstanceOf(WorkflowActionNodePolicyRefMissingException.class);
  }

  @Test
  @DisplayName(
      "graphJson V8b 위반 — ACTION 노드 policyRef에 유효하지 않은 문자 포함 시 WorkflowActionNodePolicyRefInvalidCharsException")
  void should_throwPolicyRefInvalidCharsException_when_policyRefContainsInvalidChars() {
    stubWorkspaceAndPack();
    String invalidCharsGraph =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"label\":\"시작\",\"type\":\"START\"},"
            + "{\"id\":\"action1\",\"label\":\"처리\",\"type\":\"ACTION\",\"policyRef\":\"invalid policy!\"},"
            + "{\"id\":\"terminal\",\"label\":\"종료\",\"type\":\"TERMINAL\"}"
            + "],"
            + "\"edges\":["
            + "{\"id\":\"e1\",\"from\":\"start\",\"to\":\"action1\"},"
            + "{\"id\":\"e2\",\"from\":\"action1\",\"to\":\"terminal\"}"
            + "]}";
    assertThatThrownBy(() -> useCase.execute(commandWithGraphJson(invalidCharsGraph)))
        .isInstanceOf(WorkflowActionNodePolicyRefInvalidCharsException.class);
  }

  @Test
  @DisplayName(
      "graphJson V8c 위반 — ACTION 노드 policyRef가 제출된 policies에 없으면 WorkflowActionNodePolicyRefNotFoundException")
  void should_throwPolicyRefNotFoundException_when_policyRefNotInSubmittedPolicies() {
    stubWorkspaceAndPack();
    String policyRefNotFoundGraph =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"label\":\"시작\",\"type\":\"START\"},"
            + "{\"id\":\"action1\",\"label\":\"처리\",\"type\":\"ACTION\",\"policyRef\":\"missing_policy\"},"
            + "{\"id\":\"terminal\",\"label\":\"종료\",\"type\":\"TERMINAL\"}"
            + "],"
            + "\"edges\":["
            + "{\"id\":\"e1\",\"from\":\"start\",\"to\":\"action1\"},"
            + "{\"id\":\"e2\",\"from\":\"action1\",\"to\":\"terminal\"}"
            + "]}";
    CreateDomainPackDraftCommand command =
        new CreateDomainPackDraftCommand(
            1L,
            7L,
            10L,
            null,
            "{}",
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(
                new CreateDomainPackDraftCommand.WorkflowDraft(
                    "refund_flow", "환불 플로우", null, policyRefNotFoundGraph, null, null, null, null)),
            List.of());
    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(WorkflowActionNodePolicyRefNotFoundException.class)
        .hasMessageContaining("missing_policy");
  }

  @Test
  @SuppressWarnings("unchecked")
  @DisplayName("graphJson V8c 통과 — ACTION 노드 policyRef가 제출된 policies policyCode와 일치하면 정상 저장")
  void should_saveWorkflow_when_policyRefMatchesSubmittedPolicyCode() {
    stubWorkspaceAndPack();
    stubSaveAll();

    useCase.execute(commandWithGraphJson(VALID_GRAPH_JSON));

    org.mockito.ArgumentCaptor<Iterable<WorkflowDefinition>> captor =
        org.mockito.ArgumentCaptor.forClass(Iterable.class);
    verify(workflowDefinitionRepository).saveAll(captor.capture());
    assertThat(captor.getValue().iterator().hasNext()).isTrue();
  }

  // ──────────────────────────────────────────────────────────────
  // initialState / terminalStatesJson 추출 검증 테스트
  // ──────────────────────────────────────────────────────────────

  @Test
  @SuppressWarnings("unchecked")
  @DisplayName("V1-V6 통과 시 initialState가 START 노드 id로 저장된다")
  void should_saveInitialStateAsStartNodeId_when_graphIsValid() {
    stubWorkspaceAndPack();
    stubSaveAll();

    useCase.execute(commandWithGraphJson(VALID_GRAPH_JSON));

    org.mockito.ArgumentCaptor<Iterable<WorkflowDefinition>> captor =
        org.mockito.ArgumentCaptor.forClass(Iterable.class);
    verify(workflowDefinitionRepository).saveAll(captor.capture());
    WorkflowDefinition saved = captor.getValue().iterator().next();
    assertThat(saved.getInitialState()).isEqualTo("start");
  }

  @Test
  @SuppressWarnings("unchecked")
  @DisplayName("V1-V6 통과 시 terminalStatesJson이 TERMINAL 노드 id 배열 JSON으로 저장된다")
  void should_saveTerminalStatesJsonAsTerminalNodeIds_when_graphIsValid() {
    stubWorkspaceAndPack();
    stubSaveAll();

    useCase.execute(commandWithGraphJson(VALID_GRAPH_JSON));

    org.mockito.ArgumentCaptor<Iterable<WorkflowDefinition>> captor =
        org.mockito.ArgumentCaptor.forClass(Iterable.class);
    verify(workflowDefinitionRepository).saveAll(captor.capture());
    WorkflowDefinition saved = captor.getValue().iterator().next();
    assertThat(saved.getTerminalStatesJson()).isEqualTo("[\"terminal\"]");
  }

  @Test
  @SuppressWarnings("unchecked")
  @DisplayName("TERMINAL 노드 복수 개일 때 terminalStatesJson 배열에 모두 포함된다")
  void should_includeAllTerminalNodesInTerminalStatesJson_when_multipleTerminalNodes() {
    stubWorkspaceAndPack();
    stubSaveAll();

    useCase.execute(commandWithGraphJson(VALID_GRAPH_WITH_DECISION));

    org.mockito.ArgumentCaptor<Iterable<WorkflowDefinition>> captor =
        org.mockito.ArgumentCaptor.forClass(Iterable.class);
    verify(workflowDefinitionRepository).saveAll(captor.capture());
    WorkflowDefinition saved = captor.getValue().iterator().next();
    assertThat(saved.getTerminalStatesJson()).contains("\"t1\"").contains("\"t2\"");
  }

  // ──────────────────────────────────────────────────────────────
  // 테스트 헬퍼
  // ──────────────────────────────────────────────────────────────

  private void stubWorkspaceAndPack() {
    given(workspaceExistencePort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(7L, 1L)).willReturn(true);
  }

  private void stubSaveAll() {
    given(domainPackVersionRepository.findMaxVersionNoByDomainPackId(7L))
        .willReturn(Optional.of(2));
    given(domainPackVersionRepository.saveAndFlush(any()))
        .willAnswer(invocation -> createSavedVersion(101L, 7L, 3));
    given(intentDefinitionRepository.saveAllAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(slotDefinitionRepository.saveAll(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
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
  }

  private CreateDomainPackDraftCommand commandWithGraphJson(String graphJson) {
    return new CreateDomainPackDraftCommand(
        1L,
        7L,
        10L,
        null,
        "{}",
        List.of(),
        List.of(),
        List.of(),
        List.of(
            new CreateDomainPackDraftCommand.PolicyDraft(
                "handle_policy", "처리 정책", null, null, null, null, null, null)),
        List.of(),
        List.of(
            new CreateDomainPackDraftCommand.WorkflowDraft(
                "refund_flow", "환불 플로우", null, graphJson, null, null, null, null)),
        List.of());
  }

  private CreateDomainPackDraftCommand validCommand() {
    return new CreateDomainPackDraftCommand(
        1L,
        7L,
        10L,
        55L,
        "{\"summary\":\"draft\"}",
        List.of(
            new IntentDraft("refund_request", "환불 요청", "환불 문의", 1, null, null, null, null, null),
            new IntentDraft(
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
        List.of(
            new CreateDomainPackDraftCommand.PolicyDraft(
                "handle_policy", "처리 정책", null, null, null, null, null, null)),
        List.of(),
        List.of(
            new CreateDomainPackDraftCommand.WorkflowDraft(
                "refund_flow", "환불 플로우", null, VALID_GRAPH_JSON, null, null, null, null)),
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
