package com.init.workspace.infrastructure.persistence;

import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaWorkspaceMemberRepository
    extends JpaRepository<WorkspaceMember, Long>, WorkspaceMemberRepository {

  Slice<WorkspaceMember> findByUserIdOrderByIdAsc(Long userId, Pageable pageable);

  @Override
  default Slice<WorkspaceMember> findByUserId(Long userId, Pageable pageable) {
    return findByUserIdOrderByIdAsc(userId, pageable);
  }

  Optional<WorkspaceMember> findByWorkspaceIdAndUserId(Long workspaceId, Long userId);
}
