package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.CounselorSessionResponse;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.InvalidSessionStateException;
import com.init.workflowruntime.domain.event.SessionAssignedEvent;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@ExtendWith(MockitoExtension.class)
@DisplayName("CounselorService")
class CounselorServiceTest {

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private SimpMessagingTemplate messagingTemplate;
  @Mock private ApplicationEventPublisher eventPublisher;

  @Captor private ArgumentCaptor<SessionAssignedEvent> eventCaptor;

  private CounselorService service;

  @BeforeEach
  void setUp() {
    service =
        new CounselorService(
            chatSessionRepository, chatMessageRepository, messagingTemplate, eventPublisher);
  }

  // ── assignSession ─────────────────────────────────────────────────────────

  @Test
  @DisplayName("assignSession: 정상 배정 → 상태 ACTIVE, 이벤트 발행")
  void should_assignSession_when_sessionOpen() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    CounselorSessionResponse result = service.assignSession(42L, 1L);

    assertThat(result.getStatus()).isEqualTo("ACTIVE");
    assertThat(result.getAssignedCounselorId()).isEqualTo(42L);
    verify(chatSessionRepository).save(session);
    verify(eventPublisher).publishEvent(any(SessionAssignedEvent.class));
  }

  @Test
  @DisplayName("assignSession: 세션 없음 → NotFoundException")
  void should_throwNotFoundException_when_sessionNotFound() {
    given(chatSessionRepository.findByIdForUpdate(999L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.assignSession(1L, 999L))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("Session not found: 999");
  }

  @Test
  @DisplayName("assignSession: 이미 배정된 세션 → InvalidSessionStateException")
  void should_throwInvalidState_when_alreadyAssigned() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 10L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    assertThatThrownBy(() -> service.assignSession(42L, 1L))
        .isInstanceOf(InvalidSessionStateException.class)
        .hasMessageContaining("already assigned");
  }

  @Test
  @DisplayName("assignSession: OPEN이 아닌 세션 → InvalidSessionStateException")
  void should_throwInvalidState_when_notOpen() {
    ChatSession session = createSession(1L, ChatSessionStatus.COMPLETED);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    assertThatThrownBy(() -> service.assignSession(42L, 1L))
        .isInstanceOf(com.init.workflowruntime.domain.InvalidSessionStateException.class)
        .hasMessageContaining("requires status OPEN");
  }

  // ── releaseSession ────────────────────────────────────────────────────────

  @Test
  @DisplayName("releaseSession: 정상 해제 → 상태 OPEN, assignedCounselorId null")
  void should_releaseSession_when_assignedToCounselor() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    CounselorSessionResponse result = service.releaseSession(1L, 42L);

    assertThat(result.getStatus()).isEqualTo("OPEN");
    assertThat(result.getAssignedCounselorId()).isNull();
    verify(chatSessionRepository).save(session);
  }

  @Test
  @DisplayName("releaseSession: 다른 상담사가 해제 시도 → BadRequestException")
  void should_throwBadRequest_when_notAssignedToThisCounselor() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    assertThatThrownBy(() -> service.releaseSession(1L, 99L))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("not assigned to counselor");
  }

  @Test
  @DisplayName("releaseSession: 배정되지 않은 세션 → BadRequestException")
  void should_throwBadRequest_when_notAssignedToRelease() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    assertThatThrownBy(() -> service.releaseSession(1L, 42L))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("not assigned to counselor");
  }

  // ── isSessionAssigned ─────────────────────────────────────────────────────

  @Test
  @DisplayName("isSessionAssigned: 배정됨 → true")
  void should_returnTrue_when_assigned() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));

    assertThat(service.isSessionAssigned(1L)).isTrue();
  }

  @Test
  @DisplayName("isSessionAssigned: 미배정 → false")
  void should_returnFalse_when_notAssigned() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));

    assertThat(service.isSessionAssigned(1L)).isFalse();
  }

  @Test
  @DisplayName("isSessionAssigned: 세션 없음 → NotFoundException")
  void should_throwNotFound_when_sessionNotFound() {
    given(chatSessionRepository.findById(999L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.isSessionAssigned(999L)).isInstanceOf(NotFoundException.class);
  }

  // ── getAssignedSessions ───────────────────────────────────────────────────

  @Test
  @DisplayName("getAssignedSessions: 상담사별 배정 세션 목록 반환")
  void should_returnAssignedSessions() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    given(chatSessionRepository.findByAssignedCounselorId(42L)).willReturn(List.of(session));

    List<ChatSessionResponse> result = service.getAssignedSessions(42L);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).getId()).isEqualTo(1L);
  }

  @Test
  @DisplayName("getAssignedSessions: 배정 세션 없음 → 빈 목록")
  void should_returnEmptyList_when_noAssignedSessions() {
    given(chatSessionRepository.findByAssignedCounselorId(99L)).willReturn(List.of());

    List<ChatSessionResponse> result = service.getAssignedSessions(99L);

    assertThat(result).isEmpty();
  }

  // ── sendCounselorMessage ──────────────────────────────────────────────────

  @Test
  @DisplayName("sendCounselorMessage: 정상 → 메시지 저장 및 afterCommit broadcast")
  void should_sendAndBroadcast_when_valid() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(Optional.empty());

    ChatMessage savedMsg = createMessage(1L, 1, "COUNSELOR", "Hello from counselor");
    given(chatMessageRepository.save(any())).willReturn(savedMsg);

    TransactionSynchronizationManager.initSynchronization();
    try {
      ChatMessageResponse result = service.sendCounselorMessage(1L, "Hello from counselor", 42L);

      assertThat(result).isNotNull();
      assertThat(result.content()).isEqualTo("Hello from counselor");
      assertThat(result.senderRole()).isEqualTo("COUNSELOR");
      verify(chatMessageRepository).save(any());

      verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));

      TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCommit());

      verify(messagingTemplate).convertAndSend("/topic/chat.1", result);
    } finally {
      TransactionSynchronizationManager.clearSynchronization();
    }
  }

  @Test
  @DisplayName("sendCounselorMessage: 배정되지 않은 상담사 → BadRequestException")
  void should_throwBadRequest_when_counselorNotAssignedToSend() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 10L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    assertThatThrownBy(() -> service.sendCounselorMessage(1L, "Hello", 42L))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("not assigned to counselor");
  }

  @Test
  @DisplayName("sendCounselorMessage: 세션이 ACTIVE가 아님 → BadRequestException")
  void should_throwBadRequest_when_sessionNotActive() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    assertThatThrownBy(() -> service.sendCounselorMessage(1L, "Hello", 42L))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("not ACTIVE");
  }

  // ── getSessions ───────────────────────────────────────────────────────────

  @Test
  @DisplayName("getSessions: 상태 필터 없음 → 전체 세션 페이지 반환")
  void should_returnAllSessions_when_noStatusFilter() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    Page<ChatSession> page = new PageImpl<>(List.of(session));
    given(chatSessionRepository.findAll(any(Pageable.class))).willReturn(page);

    CounselorSessionResponse result = service.getSessions(null, 0, 20);

    assertThat(result.getContent()).hasSize(1);
    assertThat(result.getTotalElements()).isEqualTo(1);
  }

  @Test
  @DisplayName("getSessions: 상태 필터 있음 → 필터링된 페이지 반환")
  void should_returnFilteredSessions_when_statusGiven() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    Page<ChatSession> page = new PageImpl<>(List.of(session));
    given(chatSessionRepository.findByStatus(any(ChatSessionStatus.class), any(Pageable.class)))
        .willReturn(page);

    CounselorSessionResponse result = service.getSessions("OPEN", 0, 20);

    assertThat(result.getContent()).hasSize(1);
  }

  @Test
  @DisplayName("getSessions: 지원하지 않는 상태 → BadRequestException")
  void should_throwBadRequest_when_invalidStatus() {
    assertThatThrownBy(() -> service.getSessions("INVALID", 0, 20))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("Unsupported status");
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private ChatSession createSession(Long id, ChatSessionStatus status) {
    ChatSession session = ChatSession.create(1L, 1L, status, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", id);
    return session;
  }

  private ChatMessage createMessage(Long sessionId, int seqNo, String role, String content) {
    ChatMessage msg = ChatMessage.create(sessionId, seqNo, role, "TEXT", content);
    ReflectionTestUtils.setField(msg, "id", 1L);
    return msg;
  }
}
