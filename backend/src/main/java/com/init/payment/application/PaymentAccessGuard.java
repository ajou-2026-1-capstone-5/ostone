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

  private final WorkspaceMembershipPort workspaceMembershipPort;

  public PaymentAccessGuard(WorkspaceMembershipPort workspaceMembershipPort) {
    this.workspaceMembershipPort = workspaceMembershipPort;
  }

  public void requireMember(Long workspaceId, Long userId) {
    if (!workspaceMembershipPort.existsById(workspaceId)) {
      throw new PaymentWorkspaceNotFoundException(workspaceId);
    }
    if (!workspaceMembershipPort.hasAnyRole(workspaceId, userId, ALLOWED_ROLES)) {
      throw new PaymentWorkspaceAccessDeniedException();
    }
  }
}
