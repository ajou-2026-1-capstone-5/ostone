package com.init.workspace.application;

import com.init.shared.application.exception.BadRequestException;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetWorkspaceMemberListUseCase {

  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final WorkspaceMemberSearchPort workspaceMemberSearchPort;

  public GetWorkspaceMemberListUseCase(
      WorkspaceMemberRepository workspaceMemberRepository,
      WorkspaceMemberSearchPort workspaceMemberSearchPort) {
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.workspaceMemberSearchPort = workspaceMemberSearchPort;
  }

  public List<WorkspaceMemberListEntry> execute(GetWorkspaceMemberListQuery query) {
    WorkspaceMember requester =
        workspaceMemberRepository
            .findByWorkspaceIdAndUserId(query.workspaceId(), query.requesterId())
            .orElseThrow(() -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));

    if (!requester.getMemberRole().canManageMembers()) {
      throw new WorkspaceAccessDeniedException("워크스페이스 멤버 관리 권한이 없습니다.");
    }

    WorkspaceMemberRole role = parseRole(query.role());
    return workspaceMemberSearchPort.searchMembers(query.workspaceId(), query.search(), role);
  }

  private WorkspaceMemberRole parseRole(String role) {
    if (role == null || role.isBlank()) {
      return null;
    }
    String normalized = role.trim().toUpperCase(Locale.ROOT);
    return Arrays.stream(WorkspaceMemberRole.values())
        .filter(candidate -> candidate.name().equals(normalized))
        .findFirst()
        .orElseThrow(
            () ->
                new BadRequestException(
                    "WORKSPACE_INVALID_MEMBER_ROLE", "워크스페이스 멤버 역할이 올바르지 않습니다: " + role));
  }
}
