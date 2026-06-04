package com.init.payment.application;

import com.init.payment.application.exception.PaymentWorkspaceAccessDeniedException;
import com.init.payment.application.exception.PaymentWorkspaceNotFoundException;
import com.init.payment.application.port.WorkspaceMembershipPort;
import java.util.Set;
import org.springframework.stereotype.Component;

/** 결제·구독 endpoint 공통 워크스페이스 멤버십 인가 (U-015). */
@Component
public class PaymentAccessGuard {

  private static final Set<String> ALLOWED_ROLES = Set.of("OWNER", "ADMIN", "OPERATOR");
  private static final Set<String> BILLING_MANAGER_ROLES = Set.of("OWNER", "ADMIN");

  private final WorkspaceMembershipPort workspaceMembershipPort;

  public PaymentAccessGuard(WorkspaceMembershipPort workspaceMembershipPort) {
    this.workspaceMembershipPort = workspaceMembershipPort;
  }

  public void requireMember(Long workspaceId, Long userId) {
    requireAnyRole(workspaceId, userId, ALLOWED_ROLES);
  }

  public void requireBillingManager(Long workspaceId, Long userId) {
    requireAnyRole(workspaceId, userId, BILLING_MANAGER_ROLES);
  }

  private void requireAnyRole(Long workspaceId, Long userId, Set<String> roles) {
    if (!workspaceMembershipPort.existsById(workspaceId)) {
      throw new PaymentWorkspaceNotFoundException(workspaceId);
    }
    if (!workspaceMembershipPort.hasAnyRole(workspaceId, userId, roles)) {
      throw new PaymentWorkspaceAccessDeniedException();
    }
  }
}
