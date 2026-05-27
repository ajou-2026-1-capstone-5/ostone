package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.GetOrCreateCurrentSessionCommand;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
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
@DisplayName("UserChatSessionService")
class UserChatSessionServiceTest {

  private static final Long WORKSPACE_ID = 10L;
  private static final Long USER_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final String CUSTOMER_NAME = "김민지";

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;
  @Mock private UserChatSessionConcurrencyGuard concurrencyGuard;
  @Mock private ApplicationEventPublisher eventPublisher;

  private UserChatSessionService service;

  @BeforeEach
  void setUp() {
    service =
        new UserChatSessionService(
            chatSessionRepository,
            domainPackVersionRepository,
            workspaceMemberRepository,
            concurrencyGuard,
            eventPublisher);
  }

  @Test
  @DisplayName("current session: 재사용 가능한 기존 세션이 있으면 반환한다")
  void should_returnExistingSession_when_reusableSessionExists() {
    ChatSession session = createSession(5L, ChatSessionStatus.OPEN);
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(
            Optional.of(WorkspaceMember.create(WORKSPACE_ID, USER_ID, WorkspaceMemberRole.OWNER)));
    given(
            chatSessionRepository
                .findFirstByWorkspaceIdAndStartedByAndStatusInOrderByStartedAtDescIdDesc(
                    any(), any(), any()))
        .willReturn(Optional.of(session));

    ChatSessionResponse result = service.getOrCreateCurrentSession(command());

    assertThat(result.getId()).isEqualTo(5L);
    assertThat(result.getStatus()).isEqualTo("OPEN");
    assertThat(result.getMetaJson()).contains("\"customerName\":\"김민지\"");
    verify(concurrencyGuard).lockCurrentSession(WORKSPACE_ID, USER_ID);
    verify(chatSessionRepository, never()).save(any());
    verify(eventPublisher, never()).publishEvent(any());
  }

  @Test
  @DisplayName("current session: 기존 세션의 다른 metaJson 필드를 보존하며 customerName만 갱신한다")
  void should_preserveExistingMetaJsonFields_when_updateCustomerName() {
    ChatSession session =
        createSession(
            5L,
            ChatSessionStatus.OPEN,
            "{\"handoffReason\":\"환불 문의\",\"demo\":true,\"customerName\":\"이전 이름\"}");
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(
            Optional.of(WorkspaceMember.create(WORKSPACE_ID, USER_ID, WorkspaceMemberRole.OWNER)));
    given(
            chatSessionRepository
                .findFirstByWorkspaceIdAndStartedByAndStatusInOrderByStartedAtDescIdDesc(
                    any(), any(), any()))
        .willReturn(Optional.of(session));

    ChatSessionResponse result = service.getOrCreateCurrentSession(command());

    assertThat(result.getMetaJson()).contains("\"customerName\":\"김민지\"");
    assertThat(result.getMetaJson()).contains("\"handoffReason\":\"환불 문의\"");
    assertThat(result.getMetaJson()).contains("\"demo\":true");
    verify(chatSessionRepository, never()).save(any());
  }

  @Test
  @DisplayName("current session: metaJson이 비어 있어도 customerName을 채운다")
  void should_fillCustomerName_when_existingMetaJsonIsBlank() {
    ChatSession session = createSession(5L, ChatSessionStatus.OPEN, " ");
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(
            Optional.of(WorkspaceMember.create(WORKSPACE_ID, USER_ID, WorkspaceMemberRole.OWNER)));
    given(
            chatSessionRepository
                .findFirstByWorkspaceIdAndStartedByAndStatusInOrderByStartedAtDescIdDesc(
                    any(), any(), any()))
        .willReturn(Optional.of(session));

    ChatSessionResponse result = service.getOrCreateCurrentSession(command());

    assertThat(result.getMetaJson()).contains("\"customerName\":\"김민지\"");
    verify(chatSessionRepository, never()).save(any());
  }

  @Test
  @DisplayName("current session: 기존 metaJson이 잘못된 JSON이면 검증 오류를 반환한다")
  void should_throwBadRequest_when_existingMetaJsonIsInvalid() {
    ChatSession session = createSession(5L, ChatSessionStatus.OPEN, "{invalid");
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(
            Optional.of(WorkspaceMember.create(WORKSPACE_ID, USER_ID, WorkspaceMemberRole.OWNER)));
    given(
            chatSessionRepository
                .findFirstByWorkspaceIdAndStartedByAndStatusInOrderByStartedAtDescIdDesc(
                    any(), any(), any()))
        .willReturn(Optional.of(session));

    assertThatThrownBy(() -> service.getOrCreateCurrentSession(command()))
        .isInstanceOf(BadRequestException.class);
  }

  @Test
  @DisplayName("current session: 기존 세션이 없으면 현재 PUBLISHED 버전으로 OPEN 세션을 생성한다")
  void should_createOpenSession_when_reusableSessionDoesNotExist() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(
            Optional.of(WorkspaceMember.create(WORKSPACE_ID, USER_ID, WorkspaceMemberRole.ADMIN)));
    given(
            chatSessionRepository
                .findFirstByWorkspaceIdAndStartedByAndStatusInOrderByStartedAtDescIdDesc(
                    any(), any(), any()))
        .willReturn(Optional.empty());
    given(domainPackVersionRepository.findCurrentPublishedByWorkspaceId(WORKSPACE_ID))
        .willReturn(
            Optional.of(
                DomainPackVersion.ofForTest(VERSION_ID, 1L, DomainPackVersion.STATUS_PUBLISHED)));
    given(chatSessionRepository.save(any(ChatSession.class)))
        .willAnswer(
            invocation -> {
              ChatSession saved = invocation.getArgument(0);
              ReflectionTestUtils.setField(saved, "id", 99L);
              return saved;
            });

    ChatSessionResponse result = service.getOrCreateCurrentSession(command());

    assertThat(result.getId()).isEqualTo(99L);
    assertThat(result.getStatus()).isEqualTo("OPEN");
    verify(concurrencyGuard).lockCurrentSession(WORKSPACE_ID, USER_ID);

    ArgumentCaptor<ChatSession> sessionCaptor = ArgumentCaptor.forClass(ChatSession.class);
    verify(chatSessionRepository).save(sessionCaptor.capture());
    ChatSession saved = sessionCaptor.getValue();
    assertThat(saved.getWorkspaceId()).isEqualTo(WORKSPACE_ID);
    assertThat(saved.getDomainPackVersionId()).isEqualTo(VERSION_ID);
    assertThat(saved.getStartedBy()).isEqualTo(USER_ID);
    assertThat(saved.getChannel()).isEqualTo("WEB");
    assertThat(saved.getMetaJson()).contains("\"customerName\":\"김민지\"");

    ArgumentCaptor<ConsultationQueueChangedEvent> eventCaptor =
        ArgumentCaptor.forClass(ConsultationQueueChangedEvent.class);
    verify(eventPublisher).publishEvent(eventCaptor.capture());
    assertThat(eventCaptor.getValue().workspaceId()).isEqualTo(WORKSPACE_ID);
    assertThat(eventCaptor.getValue().sessionId()).isEqualTo(99L);
    assertThat(eventCaptor.getValue().type())
        .isEqualTo(ConsultationQueueEventType.SESSION_UPSERTED);
  }

  @Test
  @DisplayName("current session: 워크스페이스 멤버가 아니면 거부한다")
  void should_throwWorkspaceAccessDenied_when_notWorkspaceMember() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> service.getOrCreateCurrentSession(command()))
        .isInstanceOf(WorkspaceAccessDeniedException.class);

    verify(concurrencyGuard, never()).lockCurrentSession(any(), any());
    verify(chatSessionRepository, never()).save(any());
  }

  @Test
  @DisplayName("current session command: customerName은 trim되고 공백은 거부한다")
  void should_trimAndValidateCustomerName_when_createCommand() {
    GetOrCreateCurrentSessionCommand command =
        new GetOrCreateCurrentSessionCommand(WORKSPACE_ID, USER_ID, " 김민지 ");

    assertThat(command.customerName()).isEqualTo("김민지");
    assertThatThrownBy(() -> new GetOrCreateCurrentSessionCommand(WORKSPACE_ID, USER_ID, " "))
        .isInstanceOf(BadRequestException.class);
  }

  @Test
  @DisplayName("current session: 현재 PUBLISHED 버전이 없으면 404를 반환한다")
  void should_throwNotFound_when_currentPublishedVersionMissing() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(
            Optional.of(
                WorkspaceMember.create(WORKSPACE_ID, USER_ID, WorkspaceMemberRole.OPERATOR)));
    given(
            chatSessionRepository
                .findFirstByWorkspaceIdAndStartedByAndStatusInOrderByStartedAtDescIdDesc(
                    any(), any(), any()))
        .willReturn(Optional.empty());
    given(domainPackVersionRepository.findCurrentPublishedByWorkspaceId(WORKSPACE_ID))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> service.getOrCreateCurrentSession(command()))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("workspaceId=10");

    verify(concurrencyGuard).lockCurrentSession(WORKSPACE_ID, USER_ID);
    verify(chatSessionRepository, never()).save(any());
  }

  private ChatSession createSession(Long id, ChatSessionStatus status) {
    return createSession(id, status, "{}");
  }

  private ChatSession createSession(Long id, ChatSessionStatus status, String metaJson) {
    ChatSession session =
        ChatSession.create(WORKSPACE_ID, VERSION_ID, status, "WEB", metaJson, USER_ID);
    ReflectionTestUtils.setField(session, "id", id);
    return session;
  }

  private GetOrCreateCurrentSessionCommand command() {
    return new GetOrCreateCurrentSessionCommand(WORKSPACE_ID, USER_ID, CUSTOMER_NAME);
  }
}
