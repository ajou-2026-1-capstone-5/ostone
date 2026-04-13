package com.init.workspace.application;

import com.init.workspace.domain.model.Workspace;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import com.init.workspace.domain.repository.WorkspaceRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetWorkspaceListUseCase {

  private static final int MEMBERSHIP_PAGE_SIZE = 100;

  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final WorkspaceRepository workspaceRepository;

  public GetWorkspaceListUseCase(
      WorkspaceMemberRepository workspaceMemberRepository,
      WorkspaceRepository workspaceRepository) {
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.workspaceRepository = workspaceRepository;
  }

  public List<WorkspaceResult> execute(Long userId) {
    Pageable pageable = PageRequest.of(0, MEMBERSHIP_PAGE_SIZE);
    List<WorkspaceResult> results = new ArrayList<>();

    while (true) {
      Slice<WorkspaceMember> memberships = workspaceMemberRepository.findByUserId(userId, pageable);
      if (memberships.isEmpty()) {
        return results;
      }

      List<Long> workspaceIds = memberships.stream().map(WorkspaceMember::getWorkspaceId).toList();
      List<Workspace> workspaces = workspaceRepository.findAllByIdIn(workspaceIds);
      Map<Long, Workspace> workspaceById = new LinkedHashMap<>();
      for (Workspace workspace : workspaces) {
        workspaceById.put(workspace.getId(), workspace);
      }

      results.addAll(
          memberships.stream()
              .map(member -> toResult(workspaceById, member))
              .filter(java.util.Objects::nonNull)
              .toList());

      if (!memberships.hasNext()) {
        return results;
      }

      pageable = memberships.nextPageable();
    }
  }

  private WorkspaceResult toResult(Map<Long, Workspace> workspaceById, WorkspaceMember member) {
    Workspace workspace = workspaceById.get(member.getWorkspaceId());
    if (workspace == null) {
      return null;
    }
    return WorkspaceResult.from(workspace, member);
  }
}
