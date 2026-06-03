package com.init.workspace.application;

import java.util.Optional;

public interface AdminCustomerQueryPort {

  AdminCustomerSliceResult findCustomers(AdminCustomerListQuery query);

  Optional<AdminCustomerDetailResult> findCustomerDetail(Long workspaceId);
}
