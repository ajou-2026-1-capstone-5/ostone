package com.init.payment.infrastructure.persistence;

import com.init.payment.application.port.WorkspaceMembershipPort;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import com.init.workspace.domain.repository.WorkspaceRepository;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class PaymentWorkspaceMembershipAdapter implements WorkspaceMembershipPort {

  private final WorkspaceRepository workspaceRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;

  public PaymentWorkspaceMembershipAdapter(
      WorkspaceRepository workspaceRepository,
      WorkspaceMemberRepository workspaceMemberRepository) {
    this.workspaceRepository = workspaceRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
  }

  @Override
  public boolean existsById(Long workspaceId) {
    return workspaceRepository.existsById(workspaceId);
  }

  @Override
  public boolean hasAnyRole(Long workspaceId, Long userId, Set<String> roles) {
    return workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .map(WorkspaceMember::getMemberRole)
        .map(role -> roles.contains(role.name()))
        .orElse(false);
  }
}
