package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.GetOrCreateCurrentSessionCommand;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
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
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserChatSessionService")
class UserChatSessionServiceTest {

  private static final Long WORKSPACE_ID = 10L;
  private static final Long USER_ID = 7L;
  private static final Long VERSION_ID = 101L;

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;
  @Mock private UserChatSessionConcurrencyGuard concurrencyGuard;

  private UserChatSessionService service;

  @BeforeEach
  void setUp() {
    service =
        new UserChatSessionService(
            chatSessionRepository,
            domainPackVersionRepository,
            workspaceMemberRepository,
            concurrencyGuard);
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
    verify(concurrencyGuard).lockCurrentSession(WORKSPACE_ID, USER_ID);
    verify(chatSessionRepository, never()).save(any());
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
    ChatSession session =
        ChatSession.create(WORKSPACE_ID, VERSION_ID, status, "WEB", "{}", USER_ID);
    ReflectionTestUtils.setField(session, "id", id);
    return session;
  }

  private GetOrCreateCurrentSessionCommand command() {
    return new GetOrCreateCurrentSessionCommand(WORKSPACE_ID, USER_ID);
  }
}
