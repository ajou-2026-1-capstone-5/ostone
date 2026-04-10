package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.WorkspaceMemberRole;
import java.util.Set;

/** domainpack bounded context 내 workspace 멤버십 + 역할 확인 포트 (U-005 Confirmed). */
public interface WorkspaceMembershipPort {

  boolean hasAnyRole(Long workspaceId, Long userId, Set<WorkspaceMemberRole> memberRoles);
}
