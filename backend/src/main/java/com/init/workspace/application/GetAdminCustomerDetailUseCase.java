package com.init.workspace.application;

import com.init.shared.application.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetAdminCustomerDetailUseCase {

  private final AdminCustomerQueryPort adminCustomerQueryPort;

  public GetAdminCustomerDetailUseCase(AdminCustomerQueryPort adminCustomerQueryPort) {
    this.adminCustomerQueryPort = adminCustomerQueryPort;
  }

  public AdminCustomerDetailResult execute(Long workspaceId) {
    return adminCustomerQueryPort
        .findCustomerDetail(workspaceId)
        .orElseThrow(() -> new NotFoundException("WORKSPACE_NOT_FOUND", "워크스페이스를 찾을 수 없습니다."));
  }
}
