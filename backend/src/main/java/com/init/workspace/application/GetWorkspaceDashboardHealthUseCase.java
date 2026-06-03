package com.init.workspace.application;

import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.application.exception.WorkspaceNotFoundException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import com.init.workspace.domain.repository.WorkspaceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetWorkspaceDashboardHealthUseCase {

  private final WorkspaceRepository workspaceRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final WorkspaceDashboardQueryPort workspaceDashboardQueryPort;

  public GetWorkspaceDashboardHealthUseCase(
      WorkspaceRepository workspaceRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      WorkspaceDashboardQueryPort workspaceDashboardQueryPort) {
    this.workspaceRepository = workspaceRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.workspaceDashboardQueryPort = workspaceDashboardQueryPort;
  }

  public WorkspaceDashboardHealthResult execute(Long workspaceId, Long userId) {
    if (!workspaceRepository.existsById(workspaceId)) {
      throw new WorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다.");
    }
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));

    return workspaceDashboardQueryPort.findKnowledgePackHealth(workspaceId);
  }
}
