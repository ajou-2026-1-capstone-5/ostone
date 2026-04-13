package com.init.workspace.domain.repository;

import com.init.workspace.domain.model.WorkspaceMember;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;

public interface WorkspaceMemberRepository {
  WorkspaceMember save(WorkspaceMember member);

  Slice<WorkspaceMember> findByUserId(Long userId, Pageable pageable);

  Optional<WorkspaceMember> findByWorkspaceIdAndUserId(Long workspaceId, Long userId);
}
