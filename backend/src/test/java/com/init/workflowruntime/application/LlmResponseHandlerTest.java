package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.GenerateWorkflowAwareResponseResult;
import com.init.workflowruntime.config.AiConfig;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionResponseMode;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.event.ChatMessageReceivedEvent;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("LlmResponseHandler")
class LlmResponseHandlerTest {

  @Mock private LlmAssistantService llmAssistantService;
  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private SimpMessagingTemplate messagingTemplate;
  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private ChatSessionMetadataService chatSessionMetadataService;
  @Mock private PlatformTransactionManager transactionManager;

  @Captor private ArgumentCaptor<ChatMessageResponse> responseCaptor;

  private LlmResponseHandler handler;
  private AiResponseGenerationGuard aiResponseGenerationGuard;

  @BeforeEach
  void setUp() {
    aiResponseGenerationGuard = new AiResponseGenerationGuard();
    handler =
        new LlmResponseHandler(
            llmAssistantService,
            chatMessageRepository,
            chatSessionRepository,
            messagingTemplate,
            chatSessionMetadataService,
            transactionManager,
            aiResponseGenerationGuard);
  }

  @Test
  @DisplayName("handleChatMessageReceived: LLM 자동 응답 전용 executor를 사용한다")
  void should_useDedicatedExecutor_when_asyncEventRuns() throws NoSuchMethodException {
    Async async =
        LlmResponseHandler.class
            .getMethod("handleChatMessageReceived", ChatMessageReceivedEvent.class)
            .getAnnotation(Async.class);

    assertThat(async.value()).isEqualTo(AiConfig.LLM_AUTO_RESPONSE_TASK_EXECUTOR);
  }

  @Test
  @DisplayName("handleChatMessageReceived: 정상 응답 → DB 저장 및 STOMP push")
  void should_saveAndPush_when_llmRespondsSuccessfully() {
    ChatMessageReceivedEvent event = new ChatMessageReceivedEvent(1L, "안녕하세요", 1L);
    ChatSession precheckSession = createSession(ChatSessionResponseMode.AI_ACTIVE);
    ChatSession lockSession = createSession(ChatSessionResponseMode.AI_ACTIVE);
    given(
            llmAssistantService.generateWorkflowAwareResponse(
                argThat(
                    command ->
                        command instanceof GenerateWorkflowAwareResponseCommand
                            && command.sessionId().equals(1L)
                            && command.conversationContext().isEmpty()
                            && command.userMessage().equals("안녕하세요"))))
        .willReturn(new GenerateWorkflowAwareResponseResult("안녕하세요! 무엇을 도와드릴까요?"));
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(precheckSession));
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(lockSession));
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(Optional.empty());
    given(transactionManager.getTransaction(any(TransactionDefinition.class)))
        .willReturn(new SimpleTransactionStatus());

    ChatMessage savedMsg = ChatMessage.create(1L, 1, "ASSISTANT", "TEXT", "안녕하세요! 무엇을 도와드릴까요?");
    ReflectionTestUtils.setField(savedMsg, "id", 1L);
    given(chatMessageRepository.save(any(ChatMessage.class))).willReturn(savedMsg);

    handler.handleChatMessageReceived(event);

    InOrder lockOrder = inOrder(chatSessionRepository, llmAssistantService);
    lockOrder.verify(chatSessionRepository).findById(1L);
    lockOrder.verify(llmAssistantService).generateWorkflowAwareResponse(any());
    lockOrder.verify(chatSessionRepository).findByIdForUpdate(1L);
    verify(chatMessageRepository).save(any(ChatMessage.class));
    verify(chatSessionMetadataService).updateAfterMessage(eq(lockSession), eq(savedMsg));
    verify(messagingTemplate).convertAndSend(eq("/topic/chat.1"), responseCaptor.capture());

    ChatMessageResponse pushed = responseCaptor.getValue();
    assertThat(pushed.content()).isEqualTo("안녕하세요! 무엇을 도와드릴까요?");
    assertThat(pushed.senderRole()).isEqualTo("ASSISTANT");
  }

  @Test
  @DisplayName("handleChatMessageReceived: 동일 세션 응답 생성 중이면 LLM 호출 없이 안내한다")
  void should_sendInProgressNotice_when_generationAlreadyRunningForSession() {
    ChatMessageReceivedEvent event = new ChatMessageReceivedEvent(1L, "추가 질문", 1L);
    given(chatSessionRepository.findById(1L))
        .willReturn(Optional.of(createSession(ChatSessionResponseMode.AI_ACTIVE)));
    given(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(1L)).willReturn(List.of());
    Optional<AiResponseGenerationGuard.Lease> lease = aiResponseGenerationGuard.tryEnter(1L);
    assertThat(lease).isPresent();

    try (AiResponseGenerationGuard.Lease ignored = lease.get()) {
      handler.handleChatMessageReceived(event);
    }

    verify(llmAssistantService, never()).generateWorkflowAwareResponse(any());
    verify(chatMessageRepository, never()).save(any(ChatMessage.class));
    verify(messagingTemplate).convertAndSend(eq("/topic/chat.1"), responseCaptor.capture());

    ChatMessageResponse pushed = responseCaptor.getValue();
    assertThat(pushed.senderRole()).isEqualTo("SYSTEM");
    assertThat(pushed.messageType()).isEqualTo("ERROR");
    assertThat(pushed.content()).contains(AiResponseGenerationGuard.IN_PROGRESS_CODE);
  }

  @Test
  @DisplayName("handleChatMessageReceived: LLM 예외 → fallback 메시지 STOMP push")
  void should_pushFallback_when_llmThrowsException() {
    ChatMessageReceivedEvent event = new ChatMessageReceivedEvent(1L, "안녕하세요", 1L);
    given(chatSessionRepository.findById(1L))
        .willReturn(Optional.of(createSession(ChatSessionResponseMode.AI_ACTIVE)));
    given(llmAssistantService.generateWorkflowAwareResponse(any()))
        .willThrow(new RuntimeException("API timeout"));

    handler.handleChatMessageReceived(event);

    verify(chatSessionRepository, never()).findByIdForUpdate(1L);
    verify(chatMessageRepository, never()).save(any(ChatMessage.class));
    verify(messagingTemplate).convertAndSend(eq("/topic/chat.1"), responseCaptor.capture());

    ChatMessageResponse pushed = responseCaptor.getValue();
    assertThat(pushed.senderRole()).isEqualTo("SYSTEM");
    assertThat(pushed.messageType()).isEqualTo("ERROR");
    assertThat(pushed.content()).contains("LLM_ERROR");
  }

  @Test
  @DisplayName("handleChatMessageReceived: LLM 예외 중 상담사 모드로 바뀌면 fallback 전송을 생략한다")
  void should_skipFallback_when_responseModeChangesAfterLlmException() {
    ChatMessageReceivedEvent event = new ChatMessageReceivedEvent(1L, "안녕하세요", 1L);
    given(chatSessionRepository.findById(1L))
        .willReturn(
            Optional.of(createSession(ChatSessionResponseMode.AI_ACTIVE)),
            Optional.of(createSession(ChatSessionResponseMode.HUMAN_ACTIVE)));
    given(llmAssistantService.generateWorkflowAwareResponse(any()))
        .willThrow(new RuntimeException("API timeout"));

    handler.handleChatMessageReceived(event);

    verify(chatSessionRepository, never()).findByIdForUpdate(1L);
    verify(chatMessageRepository, never()).save(any(ChatMessage.class));
    verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
  }

  @Test
  @DisplayName("handleChatMessageReceived: 저장 트랜잭션이 null 반환 → fallback 메시지 STOMP push")
  void should_pushFallback_when_saveTransactionReturnsNull() {
    ChatMessageReceivedEvent event = new ChatMessageReceivedEvent(1L, "안녕하세요", 1L);
    given(llmAssistantService.generateWorkflowAwareResponse(any()))
        .willReturn(new GenerateWorkflowAwareResponseResult("안녕하세요! 무엇을 도와드릴까요?"));
    given(chatSessionRepository.findById(1L))
        .willReturn(Optional.of(createSession(ChatSessionResponseMode.AI_ACTIVE)));
    given(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(1L)).willReturn(List.of());
    given(chatSessionRepository.findByIdForUpdate(1L))
        .willReturn(Optional.of(createSession(ChatSessionResponseMode.AI_ACTIVE)));
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(Optional.empty());
    given(transactionManager.getTransaction(any(TransactionDefinition.class)))
        .willReturn(new SimpleTransactionStatus());
    given(chatMessageRepository.save(any(ChatMessage.class))).willReturn(null);

    handler.handleChatMessageReceived(event);

    verify(chatMessageRepository).save(any(ChatMessage.class));
    verify(chatSessionMetadataService, never()).updateAfterMessage(any(), any());
    verify(messagingTemplate).convertAndSend(eq("/topic/chat.1"), responseCaptor.capture());

    ChatMessageResponse pushed = responseCaptor.getValue();
    assertThat(pushed.senderRole()).isEqualTo("SYSTEM");
    assertThat(pushed.messageType()).isEqualTo("ERROR");
    assertThat(pushed.content()).contains("LLM_ERROR");
  }

  @Test
  @DisplayName("handleChatMessageReceived: 상담사 응대 모드이면 LLM 호출과 자동 전송을 생략한다")
  void should_skipLlmAutoResponse_when_humanActive() {
    ChatMessageReceivedEvent event = new ChatMessageReceivedEvent(1L, "안녕하세요", 1L);
    given(chatSessionRepository.findById(1L))
        .willReturn(Optional.of(createSession(ChatSessionResponseMode.HUMAN_ACTIVE)));

    handler.handleChatMessageReceived(event);

    verify(llmAssistantService, never()).generateWorkflowAwareResponse(any());
    verify(chatMessageRepository, never()).save(any(ChatMessage.class));
    verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
  }

  @Test
  @DisplayName("handleChatMessageReceived: 저장 직전 모드가 바뀌면 자동 전송을 생략한다")
  void should_skipSaveAndPush_when_responseModeChangesBeforeSave() {
    ChatMessageReceivedEvent event = new ChatMessageReceivedEvent(1L, "안녕하세요", 1L);
    given(chatSessionRepository.findById(1L))
        .willReturn(Optional.of(createSession(ChatSessionResponseMode.AI_ACTIVE)));
    given(llmAssistantService.generateWorkflowAwareResponse(any()))
        .willReturn(new GenerateWorkflowAwareResponseResult("안녕하세요!"));
    given(chatSessionRepository.findByIdForUpdate(1L))
        .willReturn(Optional.of(createSession(ChatSessionResponseMode.HUMAN_ACTIVE)));
    given(transactionManager.getTransaction(any(TransactionDefinition.class)))
        .willReturn(new SimpleTransactionStatus());

    handler.handleChatMessageReceived(event);

    verify(chatMessageRepository, never()).save(any(ChatMessage.class));
    verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
  }

  private ChatSession createSession(ChatSessionResponseMode responseMode) {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, "WEB", "{}");
    if (responseMode != ChatSessionResponseMode.AI_ACTIVE) {
      session.assignTo(42L);
      session.switchResponseMode(responseMode);
    }
    return session;
  }
}
