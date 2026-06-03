package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.CreateSimulationSessionCommand;
import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
import com.init.workflowruntime.application.command.GetCurrentWorkflowCommand;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.command.SelectLlmToolIntentCommand;
import com.init.workflowruntime.application.command.SendSimulationMessageCommand;
import com.init.workflowruntime.application.dto.GenerateWorkflowAwareResponseResult;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolWorkflowResponse;
import com.init.workflowruntime.application.dto.SimulationSessionDetailResponse;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
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
@DisplayName("SimulationService")
class SimulationServiceTest {

  private static final Long WORKSPACE_ID = 10L;
  private static final Long USER_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long WORKFLOW_ID = 501L;
  private static final Long INTENT_ID = 301L;

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;
  @Mock private LlmToolService llmToolService;
  @Mock private LlmAssistantService llmAssistantService;
  @Mock private ChatSessionMetadataService chatSessionMetadataService;

  private final ObjectMapper objectMapper = new ObjectMapper();
  private SimulationService service;

  @BeforeEach
  void setUp() {
    service =
        new SimulationService(
            chatSessionRepository,
            chatMessageRepository,
            domainPackVersionRepository,
            intentDefinitionRepository,
            workflowDefinitionRepository,
            workspaceMemberRepository,
            llmToolService,
            llmAssistantService,
            chatSessionMetadataService,
            objectMapper);
  }

  @Test
  @DisplayName("createSession: SIMULATION 채널 세션을 만들고 선택 workflow를 초기화한다")
  void should_createSimulationSession_with_selectedWorkflow() {
    givenMembership();
    given(domainPackVersionRepository.findCurrentPublishedByWorkspaceId(WORKSPACE_ID))
        .willReturn(Optional.of(DomainPackVersion.ofForTest(VERSION_ID, 20L, "PUBLISHED")));
    WorkflowDefinition workflow = workflow();
    IntentDefinition intent = intent();
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.of(workflow));
    given(intentDefinitionRepository.findByIdAndDomainPackVersionId(INTENT_ID, VERSION_ID))
        .willReturn(Optional.of(intent));
    given(chatSessionRepository.save(any(ChatSession.class)))
        .willAnswer(invocation -> withId(invocation.getArgument(0), 55L));
    givenDetailDependencies(55L);

    SimulationSessionDetailResponse result =
        service.createSession(
            new CreateSimulationSessionCommand(WORKSPACE_ID, USER_ID, "테스트 고객", null, WORKFLOW_ID));

    ArgumentCaptor<ChatSession> sessionCaptor = ArgumentCaptor.forClass(ChatSession.class);
    verify(chatSessionRepository).save(sessionCaptor.capture());
    assertThat(sessionCaptor.getValue().getChannel()).isEqualTo("SIMULATION");
    assertThat(sessionCaptor.getValue().getMetaJson()).contains("\"simulation\":true");
    assertThat(result.session().getChannel()).isEqualTo("SIMULATION");
    verify(llmToolService)
        .selectIntent(new SelectLlmToolIntentCommand(55L, "refund_request", WORKFLOW_ID));
  }

  @Test
  @DisplayName("createSession: workflow 선택이 없으면 intent만 선택하고 기본 고객명을 기록한다")
  void should_createSimulationSession_with_intentOnly() {
    givenMembership();
    given(domainPackVersionRepository.findCurrentPublishedByWorkspaceId(WORKSPACE_ID))
        .willReturn(Optional.of(DomainPackVersion.ofForTest(VERSION_ID, 20L, "PUBLISHED")));
    given(chatSessionRepository.save(any(ChatSession.class)))
        .willAnswer(invocation -> withId(invocation.getArgument(0), 55L));
    givenDetailDependencies(55L);

    service.createSession(
        new CreateSimulationSessionCommand(WORKSPACE_ID, USER_ID, "  ", "refund_request", null));

    ArgumentCaptor<ChatSession> sessionCaptor = ArgumentCaptor.forClass(ChatSession.class);
    verify(chatSessionRepository).save(sessionCaptor.capture());
    assertThat(sessionCaptor.getValue().getMetaJson()).contains("\"customerName\":\"시뮬레이션 고객\"");
    assertThat(sessionCaptor.getValue().getMetaJson())
        .contains("\"selectedWorkflowDefinitionId\":null");
    verify(llmToolService)
        .selectIntent(new SelectLlmToolIntentCommand(55L, "refund_request", null));
    verifyNoInteractions(workflowDefinitionRepository, intentDefinitionRepository);
  }

  @Test
  @DisplayName("createSession: 운영 중인 Domain Pack version이 없으면 실패한다")
  void should_throw_when_currentDomainPackVersionMissing() {
    givenMembership();
    given(domainPackVersionRepository.findCurrentPublishedByWorkspaceId(WORKSPACE_ID))
        .willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                service.createSession(
                    new CreateSimulationSessionCommand(
                        WORKSPACE_ID, USER_ID, "테스트 고객", null, null)))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("현재 운영 중인 PUBLISHED version");
  }

  @Test
  @DisplayName("createSession: 선택 workflow가 현재 version 소속이 아니면 실패한다")
  void should_throw_when_selectedWorkflowMissing() {
    givenMembership();
    given(domainPackVersionRepository.findCurrentPublishedByWorkspaceId(WORKSPACE_ID))
        .willReturn(Optional.of(DomainPackVersion.ofForTest(VERSION_ID, 20L, "PUBLISHED")));
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                service.createSession(
                    new CreateSimulationSessionCommand(
                        WORKSPACE_ID, USER_ID, "테스트 고객", null, WORKFLOW_ID)))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("WorkflowDefinition not found");
  }

  @Test
  @DisplayName("listSessions: SIMULATION 채널 세션만 페이지로 조회한다")
  void should_listSimulationSessions() {
    givenMembership();
    ChatSession session = withId(simulationSession(), 55L);
    given(
            chatSessionRepository.findByWorkspaceIdAndChannelOrderByStartedAtDesc(
                any(), any(), any()))
        .willReturn(new DomainPage<>(List.of(session), 0, 100, 1, 1));

    var result = service.listSessions(WORKSPACE_ID, USER_ID, -1, 200);

    assertThat(result.content()).hasSize(1);
    assertThat(result.page()).isZero();
    assertThat(result.size()).isEqualTo(100);
    ArgumentCaptor<DomainPageRequest> pageCaptor = ArgumentCaptor.forClass(DomainPageRequest.class);
    verify(chatSessionRepository)
        .findByWorkspaceIdAndChannelOrderByStartedAtDesc(
            eq(WORKSPACE_ID), eq("SIMULATION"), pageCaptor.capture());
    assertThat(pageCaptor.getValue().page()).isZero();
    assertThat(pageCaptor.getValue().size()).isEqualTo(100);
  }

  @Test
  @DisplayName("getSession: simulation 세션 상세를 반환한다")
  void should_getSimulationSessionDetail() {
    givenMembership();
    ChatSession session = withId(simulationSession(), 55L);
    given(chatSessionRepository.findById(55L)).willReturn(Optional.of(session));
    givenDetailDependencies(55L);

    SimulationSessionDetailResponse result = service.getSession(WORKSPACE_ID, 55L, USER_ID);

    assertThat(result.session().getId()).isEqualTo(55L);
    assertThat(result.matchedWorkflow().workflowDefinitionId()).isEqualTo(WORKFLOW_ID);
  }

  @Test
  @DisplayName("getSession: simulation 채널이 아니면 찾을 수 없는 세션으로 처리한다")
  void should_throw_when_gettingNonSimulationSession() {
    givenMembership();
    ChatSession session =
        withId(
            ChatSession.create(WORKSPACE_ID, VERSION_ID, ChatSessionStatus.OPEN, "WEB", "{}"), 55L);
    given(chatSessionRepository.findById(55L)).willReturn(Optional.of(session));

    assertThatThrownBy(() -> service.getSession(WORKSPACE_ID, 55L, USER_ID))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("Simulation session not found");
  }

  @Test
  @DisplayName("sendMessage: 고객 메시지와 assistant 응답을 저장하고 상세 스냅샷을 반환한다")
  void should_sendMessage_and_returnRefreshedDetail() {
    givenMembership();
    ChatSession session = withId(simulationSession(), 55L);
    ChatMessage customerMessage = withMessageId(message(55L, 1, "USER", "환불 상태 알려주세요"), 1L);
    ChatMessage assistantMessage =
        withMessageId(message(55L, 2, "ASSISTANT", "환불 상태를 확인해드릴게요."), 2L);
    given(chatSessionRepository.findByIdForUpdate(55L)).willReturn(Optional.of(session));
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(55L))
        .willReturn(Optional.empty(), Optional.of(customerMessage));
    given(chatMessageRepository.save(any(ChatMessage.class)))
        .willReturn(customerMessage, assistantMessage);
    given(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(55L))
        .willReturn(List.of(customerMessage));
    given(
            llmAssistantService.generateWorkflowAwareResponse(
                any(GenerateWorkflowAwareResponseCommand.class)))
        .willReturn(new GenerateWorkflowAwareResponseResult("환불 상태를 확인해드릴게요."));
    givenDetailDependencies(55L);

    SimulationSessionDetailResponse result =
        service.sendMessage(
            new SendSimulationMessageCommand(WORKSPACE_ID, 55L, USER_ID, "환불 상태 알려주세요"));

    assertThat(result.messages()).hasSize(2);
    verify(chatSessionMetadataService).updateAfterMessage(session, customerMessage);
    verify(chatSessionMetadataService).updateAfterMessage(session, assistantMessage);
    verify(llmAssistantService)
        .generateWorkflowAwareResponse(any(GenerateWorkflowAwareResponseCommand.class));
  }

  @Test
  @DisplayName("sendMessage: 빈 고객 메시지는 거절한다")
  void should_throw_when_messageContentBlank() {
    givenMembership();
    ChatSession session = withId(simulationSession(), 55L);
    given(chatSessionRepository.findByIdForUpdate(55L)).willReturn(Optional.of(session));

    assertThatThrownBy(
            () ->
                service.sendMessage(
                    new SendSimulationMessageCommand(WORKSPACE_ID, 55L, USER_ID, "  ")))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("content is required");
  }

  @Test
  @DisplayName("sendMessage: 종료된 simulation 세션에는 메시지를 보낼 수 없다")
  void should_throw_when_sessionNotOpenOrActive() {
    givenMembership();
    ChatSession session =
        withId(
            ChatSession.create(
                WORKSPACE_ID, VERSION_ID, ChatSessionStatus.COMPLETED, "SIMULATION", "{}"),
            55L);
    given(chatSessionRepository.findByIdForUpdate(55L)).willReturn(Optional.of(session));

    assertThatThrownBy(
            () ->
                service.sendMessage(
                    new SendSimulationMessageCommand(WORKSPACE_ID, 55L, USER_ID, "환불 상태 알려주세요")))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("not open or active");
  }

  @Test
  @DisplayName("sendMessage: assistant 응답이 비어 있으면 fallback 응답을 저장한다")
  void should_useFallbackAssistantContent_when_generatedContentBlank() {
    givenMembership();
    ChatSession session = withId(simulationSession(), 55L);
    ChatMessage previous = withMessageId(message(55L, 1, "USER", "이전 문의"), 1L);
    ChatMessage customerMessage = withMessageId(message(55L, 2, "USER", "환불 상태 알려주세요"), 2L);
    ChatMessage assistantMessage = withMessageId(message(55L, 3, "ASSISTANT", "fallback"), 3L);
    given(chatSessionRepository.findByIdForUpdate(55L)).willReturn(Optional.of(session));
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(55L))
        .willReturn(Optional.of(previous), Optional.of(customerMessage));
    given(chatMessageRepository.save(any(ChatMessage.class)))
        .willReturn(customerMessage, assistantMessage);
    given(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(55L))
        .willReturn(List.of(customerMessage, previous));
    given(
            llmAssistantService.generateWorkflowAwareResponse(
                any(GenerateWorkflowAwareResponseCommand.class)))
        .willReturn(new GenerateWorkflowAwareResponseResult(" "));
    givenDetailDependencies(55L);

    service.sendMessage(
        new SendSimulationMessageCommand(WORKSPACE_ID, 55L, USER_ID, "환불 상태 알려주세요"));

    ArgumentCaptor<ChatMessage> messageCaptor = ArgumentCaptor.forClass(ChatMessage.class);
    verify(chatMessageRepository, org.mockito.Mockito.times(2)).save(messageCaptor.capture());
    assertThat(messageCaptor.getAllValues().get(1).getContent()).contains("현재 응답을 생성할 수 없습니다");
  }

  private void givenMembership() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(
            Optional.of(WorkspaceMember.create(WORKSPACE_ID, USER_ID, WorkspaceMemberRole.OWNER)));
  }

  private void givenDetailDependencies(Long sessionId) {
    ChatSession session = withId(simulationSession(), sessionId);
    ChatMessage customer = withMessageId(message(sessionId, 1, "USER", "환불 상태 알려주세요"), 1L);
    ChatMessage assistant = withMessageId(message(sessionId, 2, "ASSISTANT", "확인해드릴게요."), 2L);
    given(chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(sessionId))
        .willReturn(List.of(customer, assistant));
    given(
            llmToolService.getCurrentWorkflowForOperator(
                new GetCurrentWorkflowCommand(sessionId), USER_ID))
        .willReturn(
            new LlmToolWorkflowResponse(
                sessionId,
                WORKSPACE_ID,
                20L,
                VERSION_ID,
                77L,
                "RUNNING",
                "collect_order_no",
                WORKFLOW_ID,
                "refund_workflow",
                "환불 확인",
                null,
                objectMapper.createObjectNode(),
                "start",
                objectMapper.createArrayNode()));
    given(llmToolService.getContext(new GetLlmToolContextCommand(sessionId)))
        .willReturn(
            new LlmToolContextResponse(
                sessionId,
                WORKSPACE_ID,
                VERSION_ID,
                77L,
                "RUNNING",
                "collect_order_no",
                objectMapper.createObjectNode(),
                objectMapper.createObjectNode(),
                null,
                List.of(),
                List.of()));
  }

  private ChatSession simulationSession() {
    return ChatSession.create(
        WORKSPACE_ID,
        VERSION_ID,
        ChatSessionStatus.OPEN,
        "SIMULATION",
        "{\"simulation\":true}",
        USER_ID);
  }

  private WorkflowDefinition workflow() {
    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            VERSION_ID,
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

  private IntentDefinition intent() {
    IntentDefinition intent =
        IntentDefinition.create(
            VERSION_ID, "refund_request", "환불 문의", null, 1, "{}", "{}", "[]", "{}");
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

  private ChatMessage withMessageId(ChatMessage message, Long id) {
    ReflectionTestUtils.setField(message, "id", id);
    return message;
  }
}
