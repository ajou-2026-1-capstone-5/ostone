package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.WorkspaceMemberRole;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import java.util.List;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaDomainPackWorkspaceMembershipRepository
    extends JpaRepository<DomainPackWorkspaceMemberRef, Long>, WorkspaceMembershipPort {

  boolean existsByWorkspaceIdAndUserIdAndMemberRoleIn(
      Long workspaceId, Long userId, List<String> memberRoles);

  @Override
  default boolean hasAnyRole(Long workspaceId, Long userId, Set<WorkspaceMemberRole> memberRoles) {
    List<String> roleNames = memberRoles.stream().map(Enum::name).toList();
    return existsByWorkspaceIdAndUserIdAndMemberRoleIn(workspaceId, userId, roleNames);
  }
}
