package com.init.workspace.domain.repository;

import com.init.workspace.domain.model.WorkspaceMember;
import java.util.List;
import java.util.Optional;

public interface WorkspaceMemberRepository {
  WorkspaceMember save(WorkspaceMember member);

  List<WorkspaceMember> findByUserId(Long userId);

  Optional<WorkspaceMember> findByWorkspaceIdAndUserId(Long workspaceId, Long userId);
}
