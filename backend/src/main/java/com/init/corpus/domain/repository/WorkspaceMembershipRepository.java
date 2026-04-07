package com.init.corpus.domain.repository;

public interface WorkspaceMembershipRepository {

  boolean existsByWorkspaceIdAndUserId(Long workspaceId, Long userId);
}
