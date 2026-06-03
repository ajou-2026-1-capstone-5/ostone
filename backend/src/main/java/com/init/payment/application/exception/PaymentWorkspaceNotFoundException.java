package com.init.payment.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class PaymentWorkspaceNotFoundException extends NotFoundException {
  public PaymentWorkspaceNotFoundException(Long workspaceId) {
    super("WORKSPACE_NOT_FOUND", "워크스페이스를 찾을 수 없습니다. id=" + workspaceId);
  }
}
