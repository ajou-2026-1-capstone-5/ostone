package com.init.workflowruntime.application;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.GetOrCreateCurrentSessionCommand;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserChatSessionService {

  private static final String DEFAULT_CHANNEL = "WEB";
  private static final List<ChatSessionStatus> REUSABLE_STATUSES =
      List.of(ChatSessionStatus.OPEN, ChatSessionStatus.ACTIVE);

  private final ChatSessionRepository chatSessionRepository;
  private final DomainPackVersionRepository domainPackVersionRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final UserChatSessionConcurrencyGuard concurrencyGuard;

  public UserChatSessionService(
      ChatSessionRepository chatSessionRepository,
      DomainPackVersionRepository domainPackVersionRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      UserChatSessionConcurrencyGuard concurrencyGuard) {
    this.chatSessionRepository = chatSessionRepository;
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.concurrencyGuard = concurrencyGuard;
  }

  @Transactional
  public ChatSessionResponse getOrCreateCurrentSession(GetOrCreateCurrentSessionCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    concurrencyGuard.lockCurrentSession(command.workspaceId(), command.userId());

    return chatSessionRepository
        .findFirstByWorkspaceIdAndStartedByAndStatusInOrderByStartedAtDescIdDesc(
            command.workspaceId(), command.userId(), REUSABLE_STATUSES)
        .map(ChatSessionResponse::from)
        .orElseGet(
            () -> ChatSessionResponse.from(createSession(command.workspaceId(), command.userId())));
  }

  private void validateWorkspaceMembership(Long workspaceId, Long userId) {
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));
  }

  private ChatSession createSession(Long workspaceId, Long userId) {
    DomainPackVersion version =
        domainPackVersionRepository
            .findCurrentPublishedByWorkspaceId(workspaceId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "DOMAIN_PACK_CURRENT_VERSION_NOT_FOUND",
                        "현재 운영 중인 PUBLISHED version을 찾을 수 없습니다. workspaceId=" + workspaceId));

    ChatSession session =
        ChatSession.create(
            workspaceId, version.getId(), ChatSessionStatus.OPEN, DEFAULT_CHANNEL, "{}", userId);
    return chatSessionRepository.save(session);
  }
}
