package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.GenerateWorkflowAwareResponseResult;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.event.ChatMessageReceivedEvent;
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

  @BeforeEach
  void setUp() {
    handler =
        new LlmResponseHandler(
            llmAssistantService,
            chatMessageRepository,
            chatSessionRepository,
            messagingTemplate,
            chatSessionMetadataService,
            transactionManager);
  }

  @Test
  @DisplayName("handleChatMessageReceived: 정상 응답 → DB 저장 및 STOMP push")
  void should_saveAndPush_when_llmRespondsSuccessfully() {
    ChatMessageReceivedEvent event = new ChatMessageReceivedEvent(1L, "안녕하세요", 1L);
    ChatSession precheckSession = mockSession();
    ChatSession lockSession = mockSession();
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
  @DisplayName("handleChatMessageReceived: LLM 예외 → fallback 메시지 STOMP push")
  void should_pushFallback_when_llmThrowsException() {
    ChatMessageReceivedEvent event = new ChatMessageReceivedEvent(1L, "안녕하세요", 1L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(mockSession()));
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

  private ChatSession mockSession() {
    return mock(ChatSession.class);
  }
}
