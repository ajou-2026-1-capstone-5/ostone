package com.init.pipelinejob.application;

import java.util.Set;

public interface WorkspaceMembershipPort {

  boolean existsById(Long workspaceId);

  boolean hasAnyRole(Long workspaceId, Long userId, Set<String> roles);
}
