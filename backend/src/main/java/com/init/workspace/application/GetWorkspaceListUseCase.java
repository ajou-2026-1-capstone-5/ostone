package com.init.workspace.application;

import com.init.workspace.domain.model.Workspace;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import com.init.workspace.domain.repository.WorkspaceRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetWorkspaceListUseCase {

  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final WorkspaceRepository workspaceRepository;

  public GetWorkspaceListUseCase(
      WorkspaceMemberRepository workspaceMemberRepository,
      WorkspaceRepository workspaceRepository) {
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.workspaceRepository = workspaceRepository;
  }

  public List<WorkspaceResult> execute(Long userId) {
    List<WorkspaceMember> memberships = workspaceMemberRepository.findByUserId(userId);
    if (memberships.isEmpty()) {
      return List.of();
    }

    List<Long> workspaceIds = memberships.stream().map(WorkspaceMember::getWorkspaceId).toList();
    List<Workspace> workspaces = workspaceRepository.findAllByIdIn(workspaceIds);
    Map<Long, Workspace> workspaceById = new LinkedHashMap<>();
    for (Workspace workspace : workspaces) {
      workspaceById.put(workspace.getId(), workspace);
    }

    return memberships.stream()
        .map(member -> toResult(workspaceById, member))
        .filter(java.util.Objects::nonNull)
        .toList();
  }

  private WorkspaceResult toResult(Map<Long, Workspace> workspaceById, WorkspaceMember member) {
    Workspace workspace = workspaceById.get(member.getWorkspaceId());
    if (workspace == null) {
      return null;
    }
    return WorkspaceResult.from(workspace, member);
  }
}
