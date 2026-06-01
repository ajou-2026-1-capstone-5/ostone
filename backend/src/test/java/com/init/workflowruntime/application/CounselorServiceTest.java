package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.CounselorSessionResponse;
import com.init.workflowruntime.application.dto.UpdateResponseModeRequest;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionResponseMode;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.InvalidSessionStateException;
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import com.init.workflowruntime.domain.event.SessionAssignedEvent;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
  @Mock private ChatSessionMetadataService chatSessionMetadataService;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;

  private CounselorService service;

  @BeforeEach
  void setUp() {
    service =
        new CounselorService(
            chatSessionRepository,
            chatMessageRepository,
            messagingTemplate,
            eventPublisher,
            chatSessionMetadataService,
            workspaceMemberRepository);
  }

  // ── assignSession ─────────────────────────────────────────────────────────

  @Test
  @DisplayName("assignSession: 정상 배정 → 상태 ACTIVE, 이벤트 발행")
  void should_assignSession_when_sessionOpen() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, 42L);

    CounselorSessionResponse result = service.assignSession(1L, 42L);

    assertThat(result.getStatus()).isEqualTo("ACTIVE");
    assertThat(result.getAssignedCounselorId()).isEqualTo(42L);
    assertThat(result.getResponseMode()).isEqualTo("HUMAN_ACTIVE");
    verify(chatSessionRepository).save(session);
    verify(eventPublisher).publishEvent(any(SessionAssignedEvent.class));
    verifyQueueEventPublished(1L, 1L, ConsultationQueueEventType.SESSION_UPSERTED);
  }

  @Test
  @DisplayName("assignSession: 세션 없음 → NotFoundException")
  void should_throwNotFoundException_when_sessionNotFound() {
    given(chatSessionRepository.findByIdForUpdate(999L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.assignSession(999L, 1L))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("Session not found: 999");
  }

  @Test
  @DisplayName("assignSession: 세션 workspace 멤버가 아니면 거부")
  void should_throwAccessDenied_when_assignRequesterIsNotWorkspaceMember() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 42L))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> service.assignSession(1L, 42L))
        .isInstanceOf(WorkspaceAccessDeniedException.class);

    verify(chatSessionRepository, never()).save(session);
  }

  @Test
  @DisplayName("assignSession: 이미 배정된 세션 → InvalidSessionStateException")
  void should_throwInvalidState_when_alreadyAssigned() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 10L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, 42L);

    assertThatThrownBy(() -> service.assignSession(1L, 42L))
        .isInstanceOf(InvalidSessionStateException.class)
        .hasMessageContaining("already assigned");
  }

  @Test
  @DisplayName("assignSession: OPEN이 아닌 세션 → InvalidSessionStateException")
  void should_throwInvalidState_when_notOpen() {
    ChatSession session = createSession(1L, ChatSessionStatus.COMPLETED);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, 42L);

    assertThatThrownBy(() -> service.assignSession(1L, 42L))
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
    givenWorkspaceMember(1L, 42L);

    CounselorSessionResponse result = service.releaseSession(1L, 42L);

    assertThat(result.getStatus()).isEqualTo("OPEN");
    assertThat(result.getAssignedCounselorId()).isNull();
    assertThat(result.getResponseMode()).isEqualTo("AI_ACTIVE");
    verify(chatSessionRepository).save(session);
    verifyQueueEventPublished(1L, 1L, ConsultationQueueEventType.SESSION_UPSERTED);
  }

  @Test
  @DisplayName("releaseSession: 다른 상담사가 해제 시도 → BadRequestException")
  void should_throwBadRequest_when_notAssignedToThisCounselor() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, 99L);

    assertThatThrownBy(() -> service.releaseSession(1L, 99L))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("not assigned to counselor");
  }

  @Test
  @DisplayName("releaseSession: 세션 workspace 멤버가 아니면 거부")
  void should_throwAccessDenied_when_releaseRequesterIsNotWorkspaceMember() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 42L))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> service.releaseSession(1L, 42L))
        .isInstanceOf(WorkspaceAccessDeniedException.class);

    verify(chatSessionRepository, never()).save(session);
  }

  @Test
  @DisplayName("releaseSession: 배정되지 않은 세션 → BadRequestException")
  void should_throwBadRequest_when_notAssignedToRelease() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, 42L);

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
      ChatMessageResponse result =
          service.sendCounselorMessage(1L, "Hello from counselor", 42L, false);

      assertThat(result).isNotNull();
      assertThat(result.content()).isEqualTo("Hello from counselor");
      assertThat(result.senderRole()).isEqualTo("COUNSELOR");
      assertThat(session.getResponseMode()).isEqualTo(ChatSessionResponseMode.HUMAN_ACTIVE);
      verify(chatMessageRepository).save(any());
      verify(chatSessionMetadataService).updateAfterMessage(session, savedMsg);

      verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));

      TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCommit());

      verify(messagingTemplate).convertAndSend("/topic/chat.1", result);
    } finally {
      TransactionSynchronizationManager.clearSynchronization();
    }
  }

  @Test
  @DisplayName("sendCounselorMessage: isNote=true → senderRole NOTE")
  void should_saveNoteRole_when_isNoteTrue() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(Optional.empty());

    ChatMessage savedMsg = createMessage(1L, 1, "NOTE", "Hello from counselor");
    given(chatMessageRepository.save(any())).willReturn(savedMsg);

    TransactionSynchronizationManager.initSynchronization();
    try {
      ChatMessageResponse result =
          service.sendCounselorMessage(1L, "Hello from counselor", 42L, true);

      assertThat(result.senderRole()).isEqualTo("NOTE");
      assertThat(session.getResponseMode()).isEqualTo(ChatSessionResponseMode.AI_ACTIVE);
      verify(chatSessionMetadataService).updateAfterMessage(session, savedMsg);
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

    assertThatThrownBy(() -> service.sendCounselorMessage(1L, "Hello", 42L, false))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("not assigned to counselor");
  }

  @Test
  @DisplayName("sendCounselorMessage: 세션이 ACTIVE가 아님 → BadRequestException")
  void should_throwBadRequest_when_sessionNotActive() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    assertThatThrownBy(() -> service.sendCounselorMessage(1L, "Hello", 42L, false))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("not ACTIVE");
  }

  // ── getSessions ───────────────────────────────────────────────────────────

  @Test
  @DisplayName("getSessions: 상태 필터 없음 → 워크스페이스 세션 페이지 반환")
  void should_returnWorkspaceSessions_when_noStatusFilter() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    Page<ChatSession> page = new PageImpl<>(List.of(session));
    givenWorkspaceMember(1L, 7L);
    given(
            chatSessionRepository.searchByWorkspace(
                eq(1L),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                any(Pageable.class)))
        .willReturn(page);

    CounselorSessionResponse result =
        service.getSessions(1L, 7L, null, null, null, null, null, 0, 20);

    assertThat(result.getContent()).hasSize(1);
    assertThat(result.getTotalElements()).isEqualTo(1);
    verify(chatSessionRepository)
        .searchByWorkspace(
            eq(1L),
            eq(null),
            eq(null),
            eq(null),
            eq(null),
            eq(null),
            any(Pageable.class));
  }

  @Test
  @DisplayName("getSessions: 상태 필터 있음 → 워크스페이스와 상태로 필터링된 페이지 반환")
  void should_returnFilteredWorkspaceSessions_when_statusGiven() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    Page<ChatSession> page = new PageImpl<>(List.of(session));
    givenWorkspaceMember(1L, 7L);
    given(
            chatSessionRepository.searchByWorkspace(
                eq(1L),
                eq("OPEN"),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                any(Pageable.class)))
        .willReturn(page);

    CounselorSessionResponse result =
        service.getSessions(1L, 7L, "OPEN", null, null, null, null, 0, 20);

    assertThat(result.getContent()).hasSize(1);
    verify(chatSessionRepository)
        .searchByWorkspace(
            eq(1L),
            eq("OPEN"),
            eq(null),
            eq(null),
            eq(null),
            eq(null),
            any(Pageable.class));
  }

  @Test
  @DisplayName("getSessions: 검색/기간/상담사 필터를 정규화해 전달")
  void should_passSearchFilters_when_filtersGiven() {
    Page<ChatSession> page = new PageImpl<>(List.of());
    givenWorkspaceMember(1L, 7L);
    given(
            chatSessionRepository.searchByWorkspace(
                eq(1L),
                eq("COMPLETED"),
                eq("홍길동"),
                any(OffsetDateTime.class),
                any(OffsetDateTime.class),
                eq(42L),
                any(Pageable.class)))
        .willReturn(page);

    CounselorSessionResponse result =
        service.getSessions(
            1L,
            7L,
            "completed",
            "  홍길동  ",
            LocalDate.of(2026, 5, 1),
            LocalDate.of(2026, 5, 31),
            42L,
            0,
            20);

    assertThat(result.getContent()).isEmpty();
    verify(chatSessionRepository)
        .searchByWorkspace(
            eq(1L),
            eq("COMPLETED"),
            eq("홍길동"),
            any(OffsetDateTime.class),
            any(OffsetDateTime.class),
            eq(42L),
            any(Pageable.class));
  }

  @Test
  @DisplayName("getSessions: 지원하지 않는 상태 → BadRequestException")
  void should_throwBadRequest_when_invalidStatus() {
    givenWorkspaceMember(1L, 7L);

    assertThatThrownBy(
            () -> service.getSessions(1L, 7L, "INVALID", null, null, null, null, 0, 20))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("Unsupported status");
  }

  @Test
  @DisplayName("getSessions: 유효하지 않은 workspaceId → BadRequestException")
  void should_throwBadRequest_when_invalidWorkspaceId() {
    assertThatThrownBy(() -> service.getSessions(0L, 7L, null, null, null, null, null, 0, 20))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("workspaceId");
  }

  @Test
  @DisplayName("getSessions: 유효하지 않은 담당 상담사 ID → BadRequestException")
  void should_throwBadRequest_when_invalidAssignedCounselorId() {
    givenWorkspaceMember(1L, 7L);

    assertThatThrownBy(() -> service.getSessions(1L, 7L, null, null, null, null, 0L, 0, 20))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("assignedCounselorId");
  }

  @Test
  @DisplayName("getSessions: 시작일이 종료일보다 늦으면 BadRequestException")
  void should_throwBadRequest_when_invalidDateRange() {
    givenWorkspaceMember(1L, 7L);

    assertThatThrownBy(
            () ->
                service.getSessions(
                    1L,
                    7L,
                    null,
                    null,
                    LocalDate.of(2026, 6, 1),
                    LocalDate.of(2026, 5, 31),
                    null,
                    0,
                    20))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("startedFrom");
  }

  @Test
  @DisplayName("updateResponseMode: 배정 상담사가 AI 보조 모드로 전환한다")
  void should_updateResponseMode_when_assignedCounselorRequests() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, 42L);

    CounselorSessionResponse result =
        service.updateResponseMode(1L, updateResponseModeRequest(42L, "AI_ASSIST_ONLY"), 42L);

    assertThat(result.getResponseMode()).isEqualTo("AI_ASSIST_ONLY");
    assertThat(session.getResponseMode()).isEqualTo(ChatSessionResponseMode.AI_ASSIST_ONLY);
    verify(chatSessionRepository).save(session);
    verifyQueueEventPublished(1L, 1L, ConsultationQueueEventType.SESSION_UPSERTED);
  }

  @Test
  @DisplayName("updateResponseMode: 배정 상담사가 아니면 실패한다")
  void should_throwBadRequest_when_responseModeRequestedByOtherCounselor() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 99L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, 42L);
    UpdateResponseModeRequest request = updateResponseModeRequest(42L, "AI_ACTIVE");

    assertThatThrownBy(() -> service.updateResponseMode(1L, request, 42L))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("not assigned to counselor");
  }

  @Test
  @DisplayName("updateResponseMode: 요청 상담사 ID가 인증 사용자와 다르면 실패한다")
  void should_throwBadRequest_when_responseModeCounselorIdDoesNotMatchRequester() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, 42L);
    UpdateResponseModeRequest request = updateResponseModeRequest(99L, "AI_ACTIVE");

    assertThatThrownBy(() -> service.updateResponseMode(1L, request, 42L))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("counselorId must match authenticated user");
  }

  @Test
  @DisplayName("updateResponseMode: 지원하지 않는 모드는 실패한다")
  void should_throwBadRequest_when_responseModeUnsupported() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, 42L);
    UpdateResponseModeRequest request = updateResponseModeRequest(42L, "UNKNOWN");

    assertThatThrownBy(() -> service.updateResponseMode(1L, request, 42L))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("Unsupported response mode");
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private UpdateResponseModeRequest updateResponseModeRequest(Long counselorId, String mode) {
    UpdateResponseModeRequest request = new UpdateResponseModeRequest();
    request.setCounselorId(counselorId);
    request.setResponseMode(mode);
    return request;
  }

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

  private void verifyQueueEventPublished(
      Long workspaceId, Long sessionId, ConsultationQueueEventType type) {
    ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);
    verify(eventPublisher, atLeastOnce()).publishEvent(eventCaptor.capture());
    assertThat(eventCaptor.getAllValues())
        .anySatisfy(
            event -> {
              assertThat(event).isInstanceOf(ConsultationQueueChangedEvent.class);
              ConsultationQueueChangedEvent queueEvent = (ConsultationQueueChangedEvent) event;
              assertThat(queueEvent.workspaceId()).isEqualTo(workspaceId);
              assertThat(queueEvent.sessionId()).isEqualTo(sessionId);
              assertThat(queueEvent.type()).isEqualTo(type);
            });
  }

  private void givenWorkspaceMember(Long workspaceId, Long userId) {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, userId))
        .willReturn(
            Optional.of(WorkspaceMember.create(workspaceId, userId, WorkspaceMemberRole.OPERATOR)));
  }
}
