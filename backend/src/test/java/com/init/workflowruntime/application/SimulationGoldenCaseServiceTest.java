package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.workflowruntime.application.command.CreateSimulationGoldenCaseCommand;
import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
import com.init.workflowruntime.application.command.GetCurrentWorkflowCommand;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.command.InspectAssistantConversationCommand;
import com.init.workflowruntime.application.command.ReplaySimulationGoldenCaseCommand;
import com.init.workflowruntime.application.dto.AssistantConversationResult;
import com.init.workflowruntime.application.dto.AssistantConversationState;
import com.init.workflowruntime.application.dto.AssistantNextAction;
import com.init.workflowruntime.application.dto.GenerateWorkflowAwareResponseResult;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolWorkflowResponse;
import com.init.workflowruntime.application.dto.SimulationGoldenCaseReplayResultResponse;
import com.init.workflowruntime.application.dto.SimulationGoldenCaseResponse;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.SimulationGoldenCase;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayResult;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayResultRepository;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayStatus;
import com.init.workflowruntime.domain.SimulationGoldenCaseRepository;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("SimulationGoldenCaseService")
class SimulationGoldenCaseServiceTest {

  private static final Long WORKSPACE_ID = 10L;
  private static final Long USER_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long WORKFLOW_ID = 501L;
  private static final Long INTENT_ID = 301L;
  private static final Long SESSION_ID = 55L;
  private static final Long GOLDEN_CASE_ID = 900L;

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private SimulationGoldenCaseRepository goldenCaseRepository;
  @Mock private SimulationGoldenCaseReplayResultRepository replayResultRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;
  @Mock private LlmToolService llmToolService;
  @Mock private LlmAssistantService llmAssistantService;
  @Mock private WorkflowAssistantStateService workflowAssistantStateService;
  @Mock private ChatSessionMetadataService chatSessionMetadataService;

  private final ObjectMapper objectMapper = new ObjectMapper();
  private SimulationGoldenCaseService service;

  @BeforeEach
  void setUp() {
    service =
        new SimulationGoldenCaseService(
            chatSessionRepository,
            chatMessageRepository,
            goldenCaseRepository,
            replayResultRepository,
            domainPackVersionRepository,
            intentDefinitionRepository,
            workflowDefinitionRepository,
            workspaceMemberRepository,
            llmToolService,
            llmAssistantService,
            workflowAssistantStateService,
            chatSessionMetadataService,
            objectMapper);
  }

  @Test
  @DisplayName("createFromSession: 고객 입력과 기대 runtime snapshot을 검증 케이스로 저장한다")
  void should_createGoldenCase_fromSimulationSession() throws Exception {
    givenMembership();
    ChatSession session = withId(simulationSession(), SESSION_ID);
    ChatMessage firstInput = message(SESSION_ID, 1, "USER", "환불하고 싶어요");
    ChatMessage assistant = message(SESSION_ID, 2, "ASSISTANT", "주문번호를 알려주세요.");
    ChatMessage secondInput = message(SESSION_ID, 3, "CUSTOMER", "A-100 입니다");
    given(chatSessionRepository.findById(SESSION_ID)).willReturn(Optional.of(session));
    given(chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(SESSION_ID))
        .willReturn(List.of(firstInput, assistant, secondInput));
    givenCurrentRuntime(SESSION_ID, VERSION_ID, "collect_order_no", "ASK_SLOT");
    given(goldenCaseRepository.save(any(SimulationGoldenCase.class)))
        .willAnswer(invocation -> withGoldenCaseId(invocation.getArgument(0), GOLDEN_CASE_ID));

    SimulationGoldenCaseResponse result =
        service.createFromSession(
            new CreateSimulationGoldenCaseCommand(
                WORKSPACE_ID, SESSION_ID, USER_ID, "환불 검증", null, null, null, "ASK_SLOT", null));

    ArgumentCaptor<SimulationGoldenCase> captor =
        ArgumentCaptor.forClass(SimulationGoldenCase.class);
    verify(goldenCaseRepository).save(captor.capture());
    SimulationGoldenCase saved = captor.getValue();
    assertThat(result.id()).isEqualTo(GOLDEN_CASE_ID);
    assertThat(saved.getName()).isEqualTo("환불 검증");
    assertThat(saved.getInputMessagesJson()).contains("환불하고 싶어요", "A-100 입니다");
    assertThat(saved.getInputMessagesJson()).doesNotContain("주문번호를 알려주세요.");
    assertThat(objectMapper.readTree(saved.getExpectedJson()).path("intentCode").asText())
        .isEqualTo("refund_request");
    assertThat(objectMapper.readTree(saved.getExpectedJson()).path("workflowCode").asText())
        .isEqualTo("refund_workflow");
    assertThat(objectMapper.readTree(saved.getExpectedJson()).path("currentState").asText())
        .isEqualTo("collect_order_no");
    assertThat(objectMapper.readTree(saved.getExpectedJson()).path("actionType").asText())
        .isEqualTo("ASK_SLOT");
    assertThat(
            objectMapper
                .readTree(saved.getExpectedJson())
                .path("slotValues")
                .path("orderNo")
                .asText())
        .isEqualTo("A-100");
  }

  @Test
  @DisplayName("createFromSession: 기대 slot 값이 객체가 아니면 거부한다")
  void should_rejectNonObjectExpectedSlotValues() {
    givenMembership();
    ChatSession session = withId(simulationSession(), SESSION_ID);
    ChatMessage input = message(SESSION_ID, 1, "USER", "환불하고 싶어요");
    given(chatSessionRepository.findById(SESSION_ID)).willReturn(Optional.of(session));
    given(chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(SESSION_ID))
        .willReturn(List.of(input));
    givenCurrentRuntime(SESSION_ID, VERSION_ID, "collect_order_no", "ASK_SLOT");

    assertThatThrownBy(
            () ->
                service.createFromSession(
                    new CreateSimulationGoldenCaseCommand(
                        WORKSPACE_ID,
                        SESSION_ID,
                        USER_ID,
                        "환불 검증",
                        null,
                        null,
                        null,
                        "ASK_SLOT",
                        objectMapper.createArrayNode())))
        .isInstanceOfSatisfying(
            BadRequestException.class,
            exception ->
                assertThat(exception.getCode()).isEqualTo("GOLDEN_CASE_EXPECTED_SLOTS_INVALID"));
  }

  @Test
  @DisplayName("replay: 기대 snapshot과 일치하면 PASS 결과를 저장한다")
  void should_recordPass_whenReplayMatchesExpectedSnapshot() {
    givenMembership();
    SimulationGoldenCase goldenCase =
        withGoldenCaseId(goldenCase(expectedJson("collect_order_no", "ASK_SLOT")), GOLDEN_CASE_ID);
    ChatSession replaySession =
        withId(
            ChatSession.create(
                WORKSPACE_ID,
                VERSION_ID,
                ChatSessionStatus.OPEN,
                SimulationGoldenCaseService.SIMULATION_REPLAY_CHANNEL,
                "{}",
                USER_ID),
            901L);
    ChatMessage customerMessage = message(901L, 1, "USER", "환불하고 싶어요");
    ChatMessage assistantMessage = message(901L, 2, "ASSISTANT", "주문번호를 알려주세요.");
    given(goldenCaseRepository.findByIdAndWorkspaceId(GOLDEN_CASE_ID, WORKSPACE_ID))
        .willReturn(Optional.of(goldenCase));
    given(domainPackVersionRepository.findByIdAndWorkspaceId(WORKSPACE_ID, VERSION_ID))
        .willReturn(Optional.of(DomainPackVersion.ofForTest(VERSION_ID, 20L, "PUBLISHED")));
    given(chatSessionRepository.save(any(ChatSession.class))).willReturn(replaySession);
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(901L))
        .willReturn(Optional.empty(), Optional.of(customerMessage));
    given(chatMessageRepository.save(any(ChatMessage.class)))
        .willReturn(customerMessage, assistantMessage);
    given(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(901L))
        .willReturn(List.of(customerMessage));
    given(
            llmAssistantService.generateWorkflowAwareResponse(
                any(GenerateWorkflowAwareResponseCommand.class)))
        .willReturn(new GenerateWorkflowAwareResponseResult("주문번호를 알려주세요."));
    givenActualRuntime(901L, replaySession, "collect_order_no", "ASK_SLOT");
    given(replayResultRepository.save(any(SimulationGoldenCaseReplayResult.class)))
        .willAnswer(invocation -> withReplayResultId(invocation.getArgument(0), 950L));

    SimulationGoldenCaseReplayResultResponse result =
        service.replay(
            new ReplaySimulationGoldenCaseCommand(
                WORKSPACE_ID, GOLDEN_CASE_ID, VERSION_ID, USER_ID));

    ArgumentCaptor<ChatSession> sessionCaptor = ArgumentCaptor.forClass(ChatSession.class);
    verify(chatSessionRepository).save(sessionCaptor.capture());
    assertThat(sessionCaptor.getValue().getChannel()).isEqualTo("SIMULATION_REPLAY");
    assertThat(sessionCaptor.getValue().getMetaJson()).contains("\"simulationReplay\":true");
    ArgumentCaptor<SimulationGoldenCaseReplayResult> resultCaptor =
        ArgumentCaptor.forClass(SimulationGoldenCaseReplayResult.class);
    verify(replayResultRepository).save(resultCaptor.capture());
    assertThat(result.status()).isEqualTo(SimulationGoldenCaseReplayStatus.PASS);
    assertThat(resultCaptor.getValue().getFailureSummary()).isNull();
    verify(chatSessionMetadataService).updateAfterMessage(replaySession, customerMessage);
    verify(chatSessionMetadataService).updateAfterMessage(replaySession, assistantMessage);
  }

  @Test
  @DisplayName("replay: state/action/slot 불일치를 failure summary로 저장한다")
  void should_recordFail_whenReplaySnapshotDiffers() {
    givenMembership();
    SimulationGoldenCase goldenCase =
        withGoldenCaseId(expectedSlotGoldenCase("A-100"), GOLDEN_CASE_ID);
    ChatSession replaySession =
        withId(
            ChatSession.create(
                WORKSPACE_ID,
                VERSION_ID,
                ChatSessionStatus.OPEN,
                SimulationGoldenCaseService.SIMULATION_REPLAY_CHANNEL,
                "{}",
                USER_ID),
            901L);
    ChatMessage customerMessage = message(901L, 1, "USER", "환불하고 싶어요");
    ChatMessage assistantMessage = message(901L, 2, "ASSISTANT", "상담사에게 연결합니다.");
    given(goldenCaseRepository.findByIdAndWorkspaceId(GOLDEN_CASE_ID, WORKSPACE_ID))
        .willReturn(Optional.of(goldenCase));
    given(domainPackVersionRepository.findByIdAndWorkspaceId(WORKSPACE_ID, VERSION_ID))
        .willReturn(Optional.of(DomainPackVersion.ofForTest(VERSION_ID, 20L, "PUBLISHED")));
    given(chatSessionRepository.save(any(ChatSession.class))).willReturn(replaySession);
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(901L))
        .willReturn(Optional.empty(), Optional.of(customerMessage));
    given(chatMessageRepository.save(any(ChatMessage.class)))
        .willReturn(customerMessage, assistantMessage);
    given(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(901L))
        .willReturn(List.of(customerMessage));
    given(
            llmAssistantService.generateWorkflowAwareResponse(
                any(GenerateWorkflowAwareResponseCommand.class)))
        .willReturn(new GenerateWorkflowAwareResponseResult("상담사에게 연결합니다."));
    givenActualRuntime(901L, replaySession, "handoff", "HANDOFF", slotValues("B-200"));
    given(replayResultRepository.save(any(SimulationGoldenCaseReplayResult.class)))
        .willAnswer(invocation -> withReplayResultId(invocation.getArgument(0), 951L));

    SimulationGoldenCaseReplayResultResponse result =
        service.replay(
            new ReplaySimulationGoldenCaseCommand(
                WORKSPACE_ID, GOLDEN_CASE_ID, VERSION_ID, USER_ID));

    ArgumentCaptor<SimulationGoldenCaseReplayResult> resultCaptor =
        ArgumentCaptor.forClass(SimulationGoldenCaseReplayResult.class);
    verify(replayResultRepository).save(resultCaptor.capture());
    assertThat(result.status()).isEqualTo(SimulationGoldenCaseReplayStatus.FAIL);
    assertThat(resultCaptor.getValue().getFailureSummary())
        .contains("currentState expected collect_order_no but was handoff")
        .contains("actionType expected ASK_SLOT but was HANDOFF")
        .contains("slotValues.orderNo expected \"A-100\" but was \"B-200\"");
  }

  @Test
  @DisplayName("replay: runtime snapshot이 비어도 실패 결과를 저장한다")
  void should_recordFail_whenReplayRuntimeSnapshotIsMissing() {
    givenMembership();
    SimulationGoldenCase goldenCase =
        withGoldenCaseId(goldenCase(expectedJson("collect_order_no", "ASK_SLOT")), GOLDEN_CASE_ID);
    ChatSession replaySession =
        withId(
            ChatSession.create(
                WORKSPACE_ID,
                VERSION_ID,
                ChatSessionStatus.OPEN,
                SimulationGoldenCaseService.SIMULATION_REPLAY_CHANNEL,
                "{}",
                USER_ID),
            901L);
    ChatMessage customerMessage = message(901L, 1, "USER", "환불하고 싶어요");
    ChatMessage assistantMessage = message(901L, 2, "ASSISTANT", "응답을 생성하지 못했습니다.");
    given(goldenCaseRepository.findByIdAndWorkspaceId(GOLDEN_CASE_ID, WORKSPACE_ID))
        .willReturn(Optional.of(goldenCase));
    given(domainPackVersionRepository.findByIdAndWorkspaceId(WORKSPACE_ID, VERSION_ID))
        .willReturn(Optional.of(DomainPackVersion.ofForTest(VERSION_ID, 20L, "PUBLISHED")));
    given(chatSessionRepository.save(any(ChatSession.class))).willReturn(replaySession);
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(901L))
        .willReturn(Optional.empty(), Optional.of(customerMessage));
    given(chatMessageRepository.save(any(ChatMessage.class)))
        .willReturn(customerMessage, assistantMessage);
    given(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(901L))
        .willReturn(List.of(customerMessage));
    given(
            llmAssistantService.generateWorkflowAwareResponse(
                any(GenerateWorkflowAwareResponseCommand.class)))
        .willReturn(new GenerateWorkflowAwareResponseResult(null));
    given(
            workflowAssistantStateService.inspect(
                new InspectAssistantConversationCommand(replaySession.getId())))
        .willReturn(
            AssistantConversationResult.of(
                new AssistantConversationState("NO_WORKFLOW", null, null, List.of())));
    given(
            llmToolService.getCurrentWorkflowForOperator(
                new GetCurrentWorkflowCommand(replaySession.getId()), USER_ID))
        .willReturn(null);
    given(chatSessionRepository.findById(replaySession.getId()))
        .willReturn(Optional.of(replaySession));
    given(replayResultRepository.save(any(SimulationGoldenCaseReplayResult.class)))
        .willAnswer(invocation -> withReplayResultId(invocation.getArgument(0), 952L));

    SimulationGoldenCaseReplayResultResponse result =
        service.replay(
            new ReplaySimulationGoldenCaseCommand(
                WORKSPACE_ID, GOLDEN_CASE_ID, VERSION_ID, USER_ID));

    ArgumentCaptor<SimulationGoldenCaseReplayResult> resultCaptor =
        ArgumentCaptor.forClass(SimulationGoldenCaseReplayResult.class);
    verify(replayResultRepository).save(resultCaptor.capture());
    assertThat(result.status()).isEqualTo(SimulationGoldenCaseReplayStatus.FAIL);
    assertThat(resultCaptor.getValue().getFailureSummary())
        .contains("intentCode expected refund_request but was null")
        .contains("workflowCode expected refund_workflow but was null")
        .contains("currentState expected collect_order_no but was null")
        .contains("actionType expected ASK_SLOT but was null");
  }

  private void givenMembership() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(
            Optional.of(WorkspaceMember.create(WORKSPACE_ID, USER_ID, WorkspaceMemberRole.OWNER)));
  }

  private void givenCurrentRuntime(
      Long sessionId, Long versionId, String currentState, String actionType) {
    givenWorkflowLookup(versionId);
    given(
            llmToolService.getCurrentWorkflowForOperator(
                new GetCurrentWorkflowCommand(sessionId), USER_ID))
        .willReturn(workflowResponse(sessionId, versionId, currentState));
    given(llmToolService.getContext(new GetLlmToolContextCommand(sessionId)))
        .willReturn(contextResponse(sessionId, versionId, currentState, slotValues("A-100")));
  }

  private void givenActualRuntime(
      Long replaySessionId, ChatSession replaySession, String currentState, String actionType) {
    givenActualRuntime(
        replaySessionId, replaySession, currentState, actionType, slotValues("A-100"));
  }

  private void givenActualRuntime(
      Long replaySessionId,
      ChatSession replaySession,
      String currentState,
      String actionType,
      ObjectNode slotValues) {
    givenWorkflowLookup(replaySession.getDomainPackVersionId());
    given(
            workflowAssistantStateService.inspect(
                new InspectAssistantConversationCommand(replaySessionId)))
        .willReturn(
            AssistantConversationResult.of(
                new AssistantConversationState(
                    "IN_WORKFLOW",
                    null,
                    new AssistantNextAction(actionType, null, null, null, null),
                    List.of())));
    given(
            llmToolService.getCurrentWorkflowForOperator(
                new GetCurrentWorkflowCommand(replaySessionId), USER_ID))
        .willReturn(
            workflowResponse(
                replaySessionId, replaySession.getDomainPackVersionId(), currentState));
    given(chatSessionRepository.findById(replaySessionId)).willReturn(Optional.of(replaySession));
    given(llmToolService.getContext(new GetLlmToolContextCommand(replaySessionId)))
        .willReturn(
            contextResponse(
                replaySessionId, replaySession.getDomainPackVersionId(), currentState, slotValues));
  }

  private void givenWorkflowLookup(Long versionId) {
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, versionId))
        .willReturn(Optional.of(workflow(versionId)));
    given(intentDefinitionRepository.findByIdAndDomainPackVersionId(INTENT_ID, versionId))
        .willReturn(Optional.of(intent(versionId)));
  }

  private LlmToolWorkflowResponse workflowResponse(
      Long sessionId, Long versionId, String currentState) {
    return new LlmToolWorkflowResponse(
        sessionId,
        WORKSPACE_ID,
        20L,
        versionId,
        77L,
        "RUNNING",
        currentState,
        WORKFLOW_ID,
        "refund_workflow",
        "환불 확인",
        null,
        objectMapper.createObjectNode(),
        "start",
        objectMapper.createArrayNode());
  }

  private LlmToolContextResponse contextResponse(
      Long sessionId, Long versionId, String currentState, ObjectNode slotValues) {
    return new LlmToolContextResponse(
        sessionId,
        WORKSPACE_ID,
        versionId,
        77L,
        "RUNNING",
        currentState,
        slotValues,
        objectMapper.createObjectNode(),
        null,
        List.of(),
        List.of());
  }

  private SimulationGoldenCase goldenCase(String expectedJson) {
    return SimulationGoldenCase.create(
        WORKSPACE_ID,
        SESSION_ID,
        VERSION_ID,
        "환불 검증",
        """
        [{"seqNo":1,"content":"환불하고 싶어요"}]
        """,
        expectedJson,
        USER_ID);
  }

  private SimulationGoldenCase expectedSlotGoldenCase(String orderNo) {
    return goldenCase(expectedJson("collect_order_no", "ASK_SLOT", slotValues(orderNo)));
  }

  private String expectedJson(String currentState, String actionType) {
    return expectedJson(currentState, actionType, slotValues("A-100"));
  }

  private String expectedJson(String currentState, String actionType, ObjectNode slotValues) {
    ObjectNode expected = objectMapper.createObjectNode();
    expected.put("intentCode", "refund_request");
    expected.put("workflowCode", "refund_workflow");
    expected.put("currentState", currentState);
    expected.put("actionType", actionType);
    expected.set("slotValues", slotValues);
    return expected.toString();
  }

  private ObjectNode slotValues(String orderNo) {
    ObjectNode slots = objectMapper.createObjectNode();
    slots.put("orderNo", orderNo);
    return slots;
  }

  private ChatSession simulationSession() {
    return ChatSession.create(
        WORKSPACE_ID,
        VERSION_ID,
        ChatSessionStatus.OPEN,
        SimulationService.SIMULATION_CHANNEL,
        "{\"simulation\":true}",
        USER_ID);
  }

  private WorkflowDefinition workflow(Long versionId) {
    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            versionId,
            "refund_workflow",
            "환불 확인",
            null,
            "{\"nodes\":[{\"id\":\"start\",\"type\":\"START\"}]}",
            "start",
            "[]",
            "[]",
            "{}",
            INTENT_ID,
            true,
            "{}");
    ReflectionTestUtils.setField(workflow, "id", WORKFLOW_ID);
    return workflow;
  }

  private IntentDefinition intent(Long versionId) {
    IntentDefinition intent =
        IntentDefinition.create(
            versionId, "refund_request", "환불 문의", null, 1, "{}", "{}", "[]", "{}");
    ReflectionTestUtils.setField(intent, "id", INTENT_ID);
    intent.changeStatus(IntentDefinition.STATUS_PUBLISHED);
    return intent;
  }

  private ChatMessage message(Long sessionId, int seqNo, String role, String content) {
    return ChatMessage.create(sessionId, seqNo, role, "TEXT", content);
  }

  private ChatSession withId(ChatSession session, Long id) {
    ReflectionTestUtils.setField(session, "id", id);
    return session;
  }

  private SimulationGoldenCase withGoldenCaseId(SimulationGoldenCase goldenCase, Long id) {
    ReflectionTestUtils.setField(goldenCase, "id", id);
    return goldenCase;
  }

  private SimulationGoldenCaseReplayResult withReplayResultId(
      SimulationGoldenCaseReplayResult result, Long id) {
    ReflectionTestUtils.setField(result, "id", id);
    return result;
  }
}
