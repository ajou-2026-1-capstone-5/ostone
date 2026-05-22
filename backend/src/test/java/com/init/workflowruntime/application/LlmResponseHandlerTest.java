package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.workflowruntime.application.dto.ChatMessageResponse;
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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("LlmResponseHandler")
class LlmResponseHandlerTest {

  @Mock private LlmAssistantService llmAssistantService;
  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private SimpMessagingTemplate messagingTemplate;
  @Mock private ChatSessionRepository chatSessionRepository;

  @Captor private ArgumentCaptor<ChatMessageResponse> responseCaptor;

  private LlmResponseHandler handler;

  @BeforeEach
  void setUp() {
    handler =
        new LlmResponseHandler(llmAssistantService, chatMessageRepository, chatSessionRepository, messagingTemplate);
  }

  @Test
  @DisplayName("handleChatMessageReceived: 정상 응답 → DB 저장 및 STOMP push")
  void should_saveAndPush_when_llmRespondsSuccessfully() {
    ChatMessageReceivedEvent event = new ChatMessageReceivedEvent(1L, "안녕하세요", 1L);
    given(llmAssistantService.generateResponse("", "안녕하세요")).willReturn("안녕하세요! 무엇을 도와드릴까요?");
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(mockSession()));
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(Optional.empty());

    ChatMessage savedMsg = ChatMessage.create(1L, 1, "ASSISTANT", "TEXT", "안녕하세요! 무엇을 도와드릴까요?");
    ReflectionTestUtils.setField(savedMsg, "id", 1L);
    given(chatMessageRepository.save(any(ChatMessage.class))).willReturn(savedMsg);

    handler.handleChatMessageReceived(event);

    verify(chatMessageRepository).save(any(ChatMessage.class));
    verify(messagingTemplate).convertAndSend(eq("/topic/chat.1"), responseCaptor.capture());

    ChatMessageResponse pushed = responseCaptor.getValue();
    assertThat(pushed.content()).isEqualTo("안녕하세요! 무엇을 도와드릴까요?");
    assertThat(pushed.senderRole()).isEqualTo("ASSISTANT");
  }

  @Test
  @DisplayName("handleChatMessageReceived: LLM 예외 → fallback 메시지 STOMP push")
  void should_pushFallback_when_llmThrowsException() {
    ChatMessageReceivedEvent event = new ChatMessageReceivedEvent(1L, "안녕하세요", 1L);
    given(llmAssistantService.generateResponse("", "안녕하세요"))
        .willThrow(new RuntimeException("API timeout"));

    handler.handleChatMessageReceived(event);

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
