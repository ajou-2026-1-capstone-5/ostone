package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.SendMessageRequest;
import com.init.workflowruntime.application.dto.UpdateStatusRequest;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
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
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("ConsultationService")
class ConsultationServiceTest {

  private static final Long USER_ID = 7L;

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;
  @Mock private ApplicationEventPublisher eventPublisher;
  @Mock private ChatSessionMetadataService chatSessionMetadataService;

  private ConsultationService service;

  @BeforeEach
  void setUp() {
    service =
        new ConsultationService(
            chatSessionRepository,
            chatMessageRepository,
            workspaceMemberRepository,
            eventPublisher,
            chatSessionMetadataService);
  }

  @Test
  @DisplayName("getActiveQueue: handoff 세션을 일반 대기 세션보다 먼저 반환한다")
  void should_returnActiveQueue_when_called() {
    ChatSession s1 = createSession(1L, ChatSessionStatus.OPEN);
    ChatSession s2 = createSession(2L, ChatSessionStatus.ACTIVE);
    givenWorkspaceMember(1L, USER_ID);
    given(chatSessionRepository.findByWorkspaceIdAndStatusInOrderByStartedAtDesc(eq(1L), any()))
        .willReturn(List.of(s1, s2));
    given(chatSessionMetadataService.isHandoffRequired(s1)).willReturn(false);
    given(chatSessionMetadataService.isHandoffRequired(s2)).willReturn(true);

    List<ChatSessionResponse> result = service.getActiveQueue(1L, USER_ID);

    assertThat(result).hasSize(2);
    assertThat(result.get(0).getId()).isEqualTo(2L);
    assertThat(result.get(1).getId()).isEqualTo(1L);
  }

  @Test
  @DisplayName("getActiveQueue: handoff 세션끼리는 이관 발생 시각이 오래된 순서로 정렬한다")
  void should_sortHandoffSessionsByOldestHandoffTime() {
    ChatSession missingHandoffTime =
        createSession(1L, ChatSessionStatus.OPEN, "2026-06-01T11:00:00+09:00");
    ChatSession newerHandoff =
        createSession(2L, ChatSessionStatus.OPEN, "2026-06-01T09:00:00+09:00");
    ChatSession olderHandoff =
        createSession(3L, ChatSessionStatus.ACTIVE, "2026-06-01T08:00:00+09:00");
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.OPERATOR)));
    given(chatSessionRepository.findByWorkspaceIdAndStatusInOrderByStartedAtDesc(eq(1L), any()))
        .willReturn(List.of(missingHandoffTime, newerHandoff, olderHandoff));
    given(chatSessionMetadataService.isHandoffRequired(missingHandoffTime)).willReturn(true);
    given(chatSessionMetadataService.isHandoffRequired(newerHandoff)).willReturn(true);
    given(chatSessionMetadataService.isHandoffRequired(olderHandoff)).willReturn(true);
    given(chatSessionMetadataService.handoffAt(missingHandoffTime)).willReturn(null);
    given(chatSessionMetadataService.handoffAt(newerHandoff))
        .willReturn(OffsetDateTime.parse("2026-06-01T10:30:00+09:00"));
    given(chatSessionMetadataService.handoffAt(olderHandoff))
        .willReturn(OffsetDateTime.parse("2026-06-01T10:00:00+09:00"));

    List<ChatSessionResponse> result = service.getActiveQueue(1L, 7L);

    assertThat(result).extracting(ChatSessionResponse::getId).containsExactly(3L, 2L, 1L);
  }

  @Test
  @DisplayName("getActiveQueue: 일반 세션끼리는 시작 시각이 최신인 순서로 정렬한다")
  void should_sortNormalSessionsByNewestStartedAt() {
    ChatSession older = createSession(1L, ChatSessionStatus.OPEN, "2026-06-01T09:00:00+09:00");
    ChatSession newer = createSession(2L, ChatSessionStatus.ACTIVE, "2026-06-01T11:00:00+09:00");
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.OPERATOR)));
    given(chatSessionRepository.findByWorkspaceIdAndStatusInOrderByStartedAtDesc(eq(1L), any()))
        .willReturn(List.of(older, newer));
    given(chatSessionMetadataService.isHandoffRequired(older)).willReturn(false);
    given(chatSessionMetadataService.isHandoffRequired(newer)).willReturn(false);

    List<ChatSessionResponse> result = service.getActiveQueue(1L, 7L);

    assertThat(result).extracting(ChatSessionResponse::getId).containsExactly(2L, 1L);
  }

  @Test
  @DisplayName("getActiveQueue: 대기 세션 없음 → 빈 목록 반환")
  void should_returnEmptyList_when_noActiveQueue() {
    givenWorkspaceMember(1L, USER_ID);
    given(chatSessionRepository.findByWorkspaceIdAndStatusInOrderByStartedAtDesc(eq(1L), any()))
        .willReturn(List.of());

    assertThat(service.getActiveQueue(1L, USER_ID)).isEmpty();
  }

  @Test
  @DisplayName("getActiveQueue: 워크스페이스 멤버가 아니면 거부한다")
  void should_throwAccessDenied_when_queueRequesterIsNotWorkspaceMember() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, USER_ID))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> service.getActiveQueue(1L, USER_ID))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
  }

  @Test
  @DisplayName("getMessages: 세션 없음 → NotFoundException 발생")
  void should_NotFoundException발생_when_세션없음() {
    // given
    given(chatSessionRepository.findById(999L)).willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(() -> service.getMessages(999L, USER_ID))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("Session not found");
  }

  @Test
  @DisplayName("getMessages: 세션 존재 → 메시지 목록 반환")
  void should_메시지목록반환_when_세션존재() {
    // given
    ChatSession session = createSession(1L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, USER_ID);
    given(chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(1L)).willReturn(List.of());

    // when
    List<ChatMessageResponse> result = service.getMessages(1L, USER_ID);

    // then
    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("getMessages: 세션 워크스페이스 멤버가 아니면 거부한다")
  void should_throwAccessDenied_when_messageRequesterIsNotWorkspaceMember() {
    ChatSession session = createSession(1L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, USER_ID))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> service.getMessages(1L, USER_ID))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
    verify(chatMessageRepository, never()).findByChatSessionIdOrderBySeqNoAsc(1L);
  }

  @Test
  @DisplayName("sendMessage: 정상 전송 → 생성된 메시지 응답 반환")
  void should_생성된메시지반환_when_정상전송() {
    // given
    ChatSession session = createSession(1L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, USER_ID);
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(Optional.empty());

    ChatMessage savedMsg = createMessage(1L, 1, "AGENT", "Hello");
    given(chatMessageRepository.save(any())).willReturn(savedMsg);

    SendMessageRequest request = new SendMessageRequest();
    request.setContent("Hello");
    request.setNote(false);

    // when
    ChatMessageResponse result = service.sendMessage(1L, request, USER_ID);

    // then
    assertThat(result.content()).isEqualTo("Hello");
    assertThat(result.senderRole()).isEqualTo("AGENT");
    verify(chatMessageRepository).save(any());
    verify(chatSessionMetadataService).updateAfterMessage(session, savedMsg);
  }

  @Test
  @DisplayName("sendMessage: 세션 워크스페이스 멤버가 아니면 메시지를 저장하지 않는다")
  void should_throwAccessDenied_when_messageSenderIsNotWorkspaceMember() {
    ChatSession session = createSession(1L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, USER_ID))
        .willReturn(Optional.empty());

    SendMessageRequest request = new SendMessageRequest();
    request.setContent("Hello");
    request.setNote(false);

    assertThatThrownBy(() -> service.sendMessage(1L, request, USER_ID))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
    verify(chatMessageRepository, never()).save(any());
  }

  @Test
  @DisplayName("updateSessionStatus: COMPLETED → closeSession 호출 후 응답 반환")
  void should_세션응답반환_when_COMPLETED상태로변경() {
    // given
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, USER_ID);

    // when
    ChatSessionResponse result = service.updateSessionStatus(1L, "COMPLETED", USER_ID);

    // then
    assertThat(result).isNotNull();
    assertThat(result.getStatus()).isEqualTo("COMPLETED");
    ArgumentCaptor<ConsultationQueueChangedEvent> eventCaptor =
        ArgumentCaptor.forClass(ConsultationQueueChangedEvent.class);
    verify(eventPublisher).publishEvent(eventCaptor.capture());
    assertThat(eventCaptor.getValue().workspaceId()).isEqualTo(1L);
    assertThat(eventCaptor.getValue().sessionId()).isEqualTo(1L);
    assertThat(eventCaptor.getValue().type()).isEqualTo(ConsultationQueueEventType.SESSION_REMOVED);
    verify(chatSessionMetadataService).resolveHandoff(session);
  }

  @Test
  @DisplayName("updateSessionStatus: 처리 결과가 있으면 metaJson에 resolution을 기록한다")
  void should_recordResolutionMetadata_when_resolutionOutcomeExists() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, USER_ID);
    UpdateStatusRequest request = new UpdateStatusRequest();
    request.setStatus("RESOLVED");
    request.setResolutionOutcome("FOLLOW_UP_REQUIRED");
    request.setResolutionReason("배송사 확인 필요");

    ChatSessionResponse result = service.updateSessionStatus(1L, request, USER_ID);

    assertThat(result.getStatus()).isEqualTo("RESOLVED");
    verify(chatSessionMetadataService).resolveHandoff(session);
    verify(chatSessionMetadataService)
        .recordResolution(session, "FOLLOW_UP_REQUIRED", "후속 연락 필요", "RESOLVED", "배송사 확인 필요", true);
  }

  @Test
  @DisplayName("updateSessionStatus: 알 수 없는 처리 결과 → BadRequestException 발생")
  void should_throwBadRequest_when_unknownResolutionOutcome() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, USER_ID);
    UpdateStatusRequest request = new UpdateStatusRequest();
    request.setStatus("RESOLVED");
    request.setResolutionOutcome("UNKNOWN_OUTCOME");

    assertThatThrownBy(() -> service.updateSessionStatus(1L, request, USER_ID))
        .isInstanceOf(BadRequestException.class);
  }

  @Test
  @DisplayName("updateSessionStatus: 세션 워크스페이스 멤버가 아니면 상태를 변경하지 않는다")
  void should_throwAccessDenied_when_statusRequesterIsNotWorkspaceMember() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, USER_ID))
        .willReturn(Optional.empty());
    UpdateStatusRequest request = new UpdateStatusRequest();
    request.setStatus("COMPLETED");

    assertThatThrownBy(() -> service.updateSessionStatus(1L, request, USER_ID))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
    assertThat(session.getStatus()).isEqualTo(ChatSessionStatus.ACTIVE);
  }

  @Test
  @DisplayName("updateSessionStatus: 알 수 없는 상태 → BadRequestException 발생")
  void should_BadRequestException발생_when_알수없는상태() {
    // given
    ChatSession session = createSession(1L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    givenWorkspaceMember(1L, USER_ID);

    // when & then
    assertThatThrownBy(() -> service.updateSessionStatus(1L, "INVALID_STATUS", USER_ID))
        .isInstanceOf(BadRequestException.class);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private ChatSession createSession(Long id) {
    return createSession(id, ChatSessionStatus.OPEN);
  }

  private ChatSession createSession(Long id, ChatSessionStatus status) {
    ChatSession session = ChatSession.create(1L, 1L, status, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", id);
    return session;
  }

  private ChatSession createSession(Long id, ChatSessionStatus status, String startedAt) {
    ChatSession session = createSession(id, status);
    ReflectionTestUtils.setField(session, "startedAt", OffsetDateTime.parse(startedAt));
    return session;
  }

  private ChatMessage createMessage(Long sessionId, int seqNo, String role, String content) {
    ChatMessage msg = ChatMessage.create(sessionId, seqNo, role, "TEXT", content);
    ReflectionTestUtils.setField(msg, "id", 1L);
    return msg;
  }

  private void givenWorkspaceMember(Long workspaceId, Long userId) {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, userId))
        .willReturn(
            Optional.of(WorkspaceMember.create(workspaceId, userId, WorkspaceMemberRole.OPERATOR)));
  }
}
