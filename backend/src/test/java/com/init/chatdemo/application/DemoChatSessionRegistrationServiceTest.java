package com.init.chatdemo.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.init.chatdemo.application.dto.ListDemoChatMessagesCommand;
import com.init.chatdemo.application.dto.ListDemoChatMessagesResult;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.DuplicateException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.AiResponseGenerationGuard;
import com.init.workflowruntime.application.ChatSessionMetadataService;
import com.init.workflowruntime.application.LlmAssistantService;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionResponseMode;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.retry.NonTransientAiException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@ExtendWith(MockitoExtension.class)
@DisplayName("DemoChatSessionRegistrationService")
class DemoChatSessionRegistrationServiceTest {

  private static final Long WORKSPACE_ID = 2L;
  private static final Long VERSION_ID = 101L;
  private static final Long SESSION_ID = 77L;

  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private LlmAssistantService llmAssistantService;
  @Mock private SimpMessagingTemplate messagingTemplate;
  @Mock private ApplicationEventPublisher eventPublisher;
  @Mock private ChatSessionMetadataService chatSessionMetadataService;

  private DemoChatSessionRegistrationService service;
  private AiResponseGenerationGuard aiResponseGenerationGuard;

  @BeforeEach
  void setUp() {
    aiResponseGenerationGuard = new AiResponseGenerationGuard();
    service =
        new DemoChatSessionRegistrationService(
            domainPackVersionRepository,
            chatSessionRepository,
            chatMessageRepository,
            llmAssistantService,
            messagingTemplate,
            eventPublisher,
            chatSessionMetadataService,
            aiResponseGenerationGuard);
  }

  @Test
  @DisplayName("데모 채팅 세션을 runtime.chat_session에 OPEN으로 등록한다")
  void should_createOpenRuntimeSession_when_createSession() {
    given(domainPackVersionRepository.findCurrentPublishedByWorkspaceId(WORKSPACE_ID))
        .willReturn(
            Optional.of(
                DomainPackVersion.ofForTest(VERSION_ID, 1L, DomainPackVersion.STATUS_PUBLISHED)));
    given(chatSessionRepository.save(any(ChatSession.class)))
        .willAnswer(
            invocation -> {
              ChatSession session = invocation.getArgument(0);
              ReflectionTestUtils.setField(session, "id", SESSION_ID);
              return session;
            });
    given(chatMessageRepository.save(any(ChatMessage.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    ChatSessionResponse response = service.createSession(WORKSPACE_ID, " 김민지 ");

    assertThat(response.getId()).isEqualTo(SESSION_ID);
    assertThat(response.getStatus()).isEqualTo("OPEN");

    ArgumentCaptor<ChatSession> sessionCaptor = ArgumentCaptor.forClass(ChatSession.class);
    verify(chatSessionRepository).save(sessionCaptor.capture());
    ChatSession savedSession = sessionCaptor.getValue();
    assertThat(savedSession.getWorkspaceId()).isEqualTo(WORKSPACE_ID);
    assertThat(savedSession.getDomainPackVersionId()).isEqualTo(VERSION_ID);
    assertThat(savedSession.getStartedBy()).isNull();
    assertThat(savedSession.getMetaJson()).contains("\"customerName\":\"김민지\"");
    assertThat(savedSession.getMetaJson()).contains("\"demo\":true");

    ArgumentCaptor<ChatMessage> messageCaptor = ArgumentCaptor.forClass(ChatMessage.class);
    verify(chatMessageRepository).save(messageCaptor.capture());
    ChatMessage greeting = messageCaptor.getValue();
    assertThat(greeting.getChatSessionId()).isEqualTo(SESSION_ID);
    assertThat(greeting.getSenderRole()).isEqualTo("ASSISTANT");
    assertThat(greeting.getContent()).contains("김민지");
    verify(chatSessionMetadataService).updateAfterMessage(savedSession, greeting);
    verifyQueueUpsertEventPublished();
  }

  @Test
  @DisplayName("데모 사용자 메시지와 assistant 응답을 runtime.chat_message에 등록한다")
  void should_appendUserAndAssistantMessages_when_appendMessage() {
    ChatSession session =
        ChatSession.create(WORKSPACE_ID, VERSION_ID, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", SESSION_ID);
    given(chatSessionRepository.findByIdForUpdate(SESSION_ID)).willReturn(Optional.of(session));
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(SESSION_ID))
        .willReturn(Optional.empty());
    given(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(SESSION_ID))
        .willReturn(List.of(ChatMessage.create(SESSION_ID, 1, "USER", "TEXT", "Hello")));
    given(llmAssistantService.generateResponse("USER: Hello", "Hello")).willReturn("LLM 응답입니다.");
    given(chatMessageRepository.save(any(ChatMessage.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    List<ChatMessageResponse> responses =
        service.appendMessage(WORKSPACE_ID, SESSION_ID, " Hello ");

    assertThat(responses).hasSize(2);
    ArgumentCaptor<ChatMessage> messageCaptor = ArgumentCaptor.forClass(ChatMessage.class);
    verify(chatMessageRepository, times(2)).save(messageCaptor.capture());
    assertThat(messageCaptor.getAllValues())
        .extracting(ChatMessage::getSenderRole)
        .containsExactly("USER", "ASSISTANT");
    assertThat(messageCaptor.getAllValues())
        .extracting(ChatMessage::getSeqNo)
        .containsExactly(1, 2);
    assertThat(messageCaptor.getAllValues().get(1).getContent()).isEqualTo("LLM 응답입니다.");
    verify(chatSessionMetadataService)
        .updateAfterMessage(session, messageCaptor.getAllValues().get(0));
    verifyQueueUpsertEventPublished();
    verify(llmAssistantService).generateResponse("USER: Hello", "Hello");
    verify(messagingTemplate).convertAndSend("/topic/chat.77", responses.get(0));
    verify(messagingTemplate).convertAndSend("/topic/chat.77", responses.get(1));
  }

  @Test
  @DisplayName("상담사 배정 세션은 데모 사용자 메시지만 저장하고 assistant 자동응답을 생성하지 않는다")
  void should_appendOnlyUserMessage_when_humanActiveSession() {
    ChatSession session =
        ChatSession.create(WORKSPACE_ID, VERSION_ID, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", SESSION_ID);
    session.assignTo(11L);
    given(chatSessionRepository.findByIdForUpdate(SESSION_ID)).willReturn(Optional.of(session));
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(SESSION_ID))
        .willReturn(Optional.of(ChatMessage.create(SESSION_ID, 2, "ASSISTANT", "TEXT", "이전 답변")));
    given(chatMessageRepository.save(any(ChatMessage.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    List<ChatMessageResponse> responses =
        service.appendMessage(WORKSPACE_ID, SESSION_ID, " 아직 답변 없나요? ");

    assertThat(responses).hasSize(1);
    assertThat(responses.get(0).senderRole()).isEqualTo("USER");
    assertThat(responses.get(0).seqNo()).isEqualTo(3);
    assertThat(responses.get(0).content()).isEqualTo("아직 답변 없나요?");

    ArgumentCaptor<ChatMessage> messageCaptor = ArgumentCaptor.forClass(ChatMessage.class);
    verify(chatMessageRepository).save(messageCaptor.capture());
    assertThat(messageCaptor.getValue().getSenderRole()).isEqualTo("USER");
    verify(chatMessageRepository, never()).findTop5ByChatSessionIdOrderBySeqNoDesc(SESSION_ID);
    verify(llmAssistantService, never()).generateResponse(any(), any());
    verify(chatSessionMetadataService).updateAfterMessage(session, messageCaptor.getValue());
    verifyQueueUpsertEventPublished();
    verify(messagingTemplate).convertAndSend("/topic/chat.77", responses.get(0));
  }

  @Test
  @DisplayName("AI 보조 모드 세션은 데모 사용자 메시지만 저장하고 assistant 자동응답을 생성하지 않는다")
  void should_appendOnlyUserMessage_when_aiAssistOnlySession() {
    ChatSession session =
        ChatSession.create(WORKSPACE_ID, VERSION_ID, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", SESSION_ID);
    session.assignTo(11L);
    session.switchResponseMode(ChatSessionResponseMode.AI_ASSIST_ONLY);
    given(chatSessionRepository.findByIdForUpdate(SESSION_ID)).willReturn(Optional.of(session));
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(SESSION_ID))
        .willReturn(Optional.empty());
    given(chatMessageRepository.save(any(ChatMessage.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    List<ChatMessageResponse> responses =
        service.appendMessage(WORKSPACE_ID, SESSION_ID, " 상담사에게 전달해주세요 ");

    assertThat(responses).hasSize(1);
    assertThat(responses.get(0).senderRole()).isEqualTo("USER");
    assertThat(responses.get(0).seqNo()).isEqualTo(1);
    assertThat(responses.get(0).content()).isEqualTo("상담사에게 전달해주세요");

    ArgumentCaptor<ChatMessage> messageCaptor = ArgumentCaptor.forClass(ChatMessage.class);
    verify(chatMessageRepository).save(messageCaptor.capture());
    assertThat(messageCaptor.getValue().getSenderRole()).isEqualTo("USER");
    verify(chatMessageRepository, never()).findTop5ByChatSessionIdOrderBySeqNoDesc(SESSION_ID);
    verify(llmAssistantService, never()).generateResponse(any(), any());
    verify(chatSessionMetadataService).updateAfterMessage(session, messageCaptor.getValue());
    verifyQueueUpsertEventPublished();
    verify(messagingTemplate).convertAndSend("/topic/chat.77", responses.get(0));
  }

  @Test
  @DisplayName("데모 LLM 호출이 실패해도 안내 응답을 저장하고 메시지 전송을 완료한다")
  void should_appendFallbackAssistantMessage_when_llmCallFails() {
    ChatSession session =
        ChatSession.create(WORKSPACE_ID, VERSION_ID, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", SESSION_ID);
    given(chatSessionRepository.findByIdForUpdate(SESSION_ID)).willReturn(Optional.of(session));
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(SESSION_ID))
        .willReturn(Optional.empty());
    given(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(SESSION_ID))
        .willReturn(List.of());
    given(llmAssistantService.generateResponse("", "배송 상태 확인하고 싶어요"))
        .willThrow(new NonTransientAiException("quota exceeded"));
    given(chatMessageRepository.save(any(ChatMessage.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    List<ChatMessageResponse> responses =
        service.appendMessage(WORKSPACE_ID, SESSION_ID, " 배송 상태 확인하고 싶어요 ");

    assertThat(responses).hasSize(2);
    assertThat(responses.get(0).senderRole()).isEqualTo("USER");
    assertThat(responses.get(1).senderRole()).isEqualTo("ASSISTANT");
    assertThat(responses.get(1).content()).contains("자동 응답 생성이 원활하지 않습니다");
    verify(messagingTemplate).convertAndSend("/topic/chat.77", responses.get(0));
    verify(messagingTemplate).convertAndSend("/topic/chat.77", responses.get(1));
  }

  @Test
  @DisplayName("데모 세션 응답 생성 중이면 추가 메시지를 저장하지 않고 충돌로 거절한다")
  void should_throwConflictWithoutSaving_when_generationAlreadyRunningForSession() {
    Optional<AiResponseGenerationGuard.Lease> lease =
        aiResponseGenerationGuard.tryEnter(SESSION_ID);
    assertThat(lease).isPresent();
    ChatSession session =
        ChatSession.create(WORKSPACE_ID, VERSION_ID, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", SESSION_ID);
    given(chatSessionRepository.findById(SESSION_ID)).willReturn(Optional.of(session));

    try (AiResponseGenerationGuard.Lease ignored = lease.get()) {
      assertThatThrownBy(() -> service.appendMessage(WORKSPACE_ID, SESSION_ID, "추가 질문"))
          .isInstanceOf(DuplicateException.class)
          .satisfies(
              throwable ->
                  assertThat(((DuplicateException) throwable).getCode())
                      .isEqualTo(AiResponseGenerationGuard.IN_PROGRESS_CODE));
    }

    verify(chatSessionRepository, never()).findByIdForUpdate(SESSION_ID);
    verify(chatMessageRepository, never()).save(any(ChatMessage.class));
    verify(llmAssistantService, never()).generateResponse(any(), any());
    verify(messagingTemplate, never()).convertAndSend(any(), any(ChatMessageResponse.class));
  }

  @Test
  @DisplayName("데모 세션 메시지를 runtime.chat_message에서 시간순으로 조회한다")
  void should_listRegisteredMessages_when_listMessages() {
    ChatSession session =
        ChatSession.create(WORKSPACE_ID, VERSION_ID, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", SESSION_ID);
    ChatMessage greeting = ChatMessage.create(SESSION_ID, 1, "ASSISTANT", "TEXT", "안녕하세요");
    ReflectionTestUtils.setField(greeting, "id", 1L);
    given(chatSessionRepository.findById(SESSION_ID)).willReturn(Optional.of(session));
    given(chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(SESSION_ID))
        .willReturn(List.of(greeting));

    ListDemoChatMessagesResult result =
        service.listMessages(new ListDemoChatMessagesCommand(WORKSPACE_ID, SESSION_ID));

    List<ChatMessageResponse> responses = result.getMessages();
    assertThat(responses).hasSize(1);
    assertThat(responses.get(0).senderRole()).isEqualTo("ASSISTANT");
    assertThat(responses.get(0).content()).isEqualTo("안녕하세요");
  }

  @Test
  @DisplayName("다른 워크스페이스의 데모 세션 메시지는 조회하지 않는다")
  void should_throwNotFound_when_listMessagesWorkspaceMismatch() {
    ChatSession session =
        ChatSession.create(WORKSPACE_ID + 1, VERSION_ID, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", SESSION_ID);
    given(chatSessionRepository.findById(SESSION_ID)).willReturn(Optional.of(session));

    assertThatThrownBy(
            () -> service.listMessages(new ListDemoChatMessagesCommand(WORKSPACE_ID, SESSION_ID)))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("Session not found: 77");
  }

  @Test
  @DisplayName("데모 메시지 컨텍스트는 최근 메시지를 시간순으로 정렬해 LLM에 전달한다")
  void should_sendConversationContextInAscendingOrder_when_appendMessage() {
    ChatSession session =
        ChatSession.create(WORKSPACE_ID, VERSION_ID, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", SESSION_ID);
    given(chatSessionRepository.findByIdForUpdate(SESSION_ID)).willReturn(Optional.of(session));
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(SESSION_ID))
        .willReturn(Optional.of(ChatMessage.create(SESSION_ID, 3, "ASSISTANT", "TEXT", "최근 답변")));
    given(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(SESSION_ID))
        .willReturn(
            List.of(
                ChatMessage.create(SESSION_ID, 3, "ASSISTANT", "TEXT", "최근 답변"),
                ChatMessage.create(SESSION_ID, 2, "USER", "TEXT", "이전 질문")));
    given(llmAssistantService.generateResponse("USER: 이전 질문\nASSISTANT: 최근 답변", "다음 질문"))
        .willReturn("다음 답변");
    given(chatMessageRepository.save(any(ChatMessage.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    List<ChatMessageResponse> responses =
        service.appendMessage(WORKSPACE_ID, SESSION_ID, " 다음 질문 ");

    assertThat(responses).hasSize(2);
    assertThat(responses.get(0).seqNo()).isEqualTo(4);
    assertThat(responses.get(1).seqNo()).isEqualTo(5);
    verify(llmAssistantService).generateResponse("USER: 이전 질문\nASSISTANT: 최근 답변", "다음 질문");
  }

  @Test
  @DisplayName("데모 세션 생성 시 운영 중인 domain pack version이 없으면 404를 반환한다")
  void should_throwNotFound_when_currentPublishedVersionMissing() {
    given(domainPackVersionRepository.findCurrentPublishedByWorkspaceId(WORKSPACE_ID))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> service.createSession(WORKSPACE_ID, "김민지"))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("workspaceId=2");
  }

  @Test
  @DisplayName("데모 사용자 이름과 메시지가 비어 있으면 검증 오류를 반환한다")
  void should_throwBadRequest_when_blankInputs() {
    assertThatThrownBy(() -> service.createSession(WORKSPACE_ID, " "))
        .isInstanceOf(BadRequestException.class);
    assertThatThrownBy(() -> service.appendMessage(WORKSPACE_ID, SESSION_ID, " "))
        .isInstanceOf(BadRequestException.class);
  }

  @Test
  @DisplayName("트랜잭션 커밋 후 WebSocket 브로드캐스트 실패는 API 응답을 깨지 않는다")
  void should_swallowBroadcastError_afterCommit() {
    ChatSession session =
        ChatSession.create(WORKSPACE_ID, VERSION_ID, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", SESSION_ID);
    given(chatSessionRepository.findByIdForUpdate(SESSION_ID)).willReturn(Optional.of(session));
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(SESSION_ID))
        .willReturn(Optional.empty());
    given(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(SESSION_ID))
        .willReturn(List.of());
    given(llmAssistantService.generateResponse("", "Hello")).willReturn("LLM 응답입니다.");
    given(chatMessageRepository.save(any(ChatMessage.class)))
        .willAnswer(invocation -> invocation.getArgument(0));
    doThrow(new RuntimeException("broker unavailable"))
        .when(messagingTemplate)
        .convertAndSend(eq("/topic/chat.77"), any(ChatMessageResponse.class));

    TransactionSynchronizationManager.initSynchronization();
    try {
      List<ChatMessageResponse> responses =
          service.appendMessage(WORKSPACE_ID, SESSION_ID, "Hello");

      assertThat(responses).hasSize(2);
      verify(messagingTemplate, never())
          .convertAndSend(eq("/topic/chat.77"), any(ChatMessageResponse.class));
      assertThatCode(
              () ->
                  TransactionSynchronizationManager.getSynchronizations().stream()
                      .forEach(TransactionSynchronization::afterCommit))
          .doesNotThrowAnyException();
      verify(messagingTemplate)
          .convertAndSend(eq("/topic/chat.77"), any(ChatMessageResponse.class));
    } finally {
      TransactionSynchronizationManager.clearSynchronization();
    }
  }

  private void verifyQueueUpsertEventPublished() {
    ArgumentCaptor<ConsultationQueueChangedEvent> eventCaptor =
        ArgumentCaptor.forClass(ConsultationQueueChangedEvent.class);
    verify(eventPublisher).publishEvent(eventCaptor.capture());
    assertThat(eventCaptor.getValue().workspaceId()).isEqualTo(WORKSPACE_ID);
    assertThat(eventCaptor.getValue().sessionId()).isEqualTo(SESSION_ID);
    assertThat(eventCaptor.getValue().type())
        .isEqualTo(ConsultationQueueEventType.SESSION_UPSERTED);
  }
}
