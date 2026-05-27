package com.init.chatdemo.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.LlmAssistantService;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
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
@DisplayName("DemoChatSessionRegistrationService")
class DemoChatSessionRegistrationServiceTest {

  private static final Long WORKSPACE_ID = 2L;
  private static final Long VERSION_ID = 101L;
  private static final Long SESSION_ID = 77L;

  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private LlmAssistantService llmAssistantService;

  private DemoChatSessionRegistrationService service;

  @BeforeEach
  void setUp() {
    service =
        new DemoChatSessionRegistrationService(
            domainPackVersionRepository,
            chatSessionRepository,
            chatMessageRepository,
            llmAssistantService);
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
    verify(llmAssistantService).generateResponse("USER: Hello", "Hello");
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
}
