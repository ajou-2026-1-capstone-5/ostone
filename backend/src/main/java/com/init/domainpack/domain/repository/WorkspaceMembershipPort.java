package com.init.domainpack.domain.repository;

import java.util.List;

/** domainpack bounded context 내 workspace 멤버십 + 역할 확인 포트 (U-005 Confirmed). */
public interface WorkspaceMembershipPort {

  boolean existsByWorkspaceIdAndUserIdAndMemberRoleIn(
      Long workspaceId, Long userId, List<String> memberRoles);
}
