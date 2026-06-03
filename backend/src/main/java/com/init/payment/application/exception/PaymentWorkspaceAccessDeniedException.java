package com.init.payment.application.exception;

import com.init.shared.application.exception.UnauthorizedException;

public class PaymentWorkspaceAccessDeniedException extends UnauthorizedException {
  public PaymentWorkspaceAccessDeniedException() {
    super("WORKSPACE_ACCESS_DENIED", "해당 워크스페이스의 결제를 관리할 권한이 없습니다.");
  }
}
