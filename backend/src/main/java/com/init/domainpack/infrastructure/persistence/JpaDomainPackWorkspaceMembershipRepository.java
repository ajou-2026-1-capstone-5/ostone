package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaDomainPackWorkspaceMembershipRepository
    extends JpaRepository<DomainPackWorkspaceMemberRef, Long>, WorkspaceMembershipPort {

  boolean existsByWorkspaceIdAndUserIdAndMemberRoleIn(
      Long workspaceId, Long userId, List<String> memberRoles);
}
