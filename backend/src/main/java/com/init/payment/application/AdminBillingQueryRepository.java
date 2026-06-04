package com.init.payment.application;

import java.util.List;

public interface AdminBillingQueryRepository {
  List<AdminBillingCustomerSummary> findCustomerSummaries();
}
