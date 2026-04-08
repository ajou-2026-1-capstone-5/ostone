package com.init.corpus.infrastructure.persistence;

import com.init.corpus.domain.repository.WorkspaceMembershipRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaWorkspaceMembershipRepository
    extends JpaRepository<WorkspaceMemberRef, Long>, WorkspaceMembershipRepository {

  boolean existsByWorkspaceIdAndUserId(Long workspaceId, Long userId);
}
