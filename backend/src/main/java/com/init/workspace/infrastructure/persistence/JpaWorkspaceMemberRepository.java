package com.init.workspace.infrastructure.persistence;

import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaWorkspaceMemberRepository
    extends JpaRepository<WorkspaceMember, Long>, WorkspaceMemberRepository {

  List<WorkspaceMember> findByUserId(Long userId);

  Optional<WorkspaceMember> findByWorkspaceIdAndUserId(Long workspaceId, Long userId);
}
