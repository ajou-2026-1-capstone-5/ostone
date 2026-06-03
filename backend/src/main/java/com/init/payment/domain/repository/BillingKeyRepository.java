package com.init.payment.domain.repository;

import com.init.payment.domain.model.BillingKey;
import java.util.Optional;

public interface BillingKeyRepository {

  BillingKey save(BillingKey billingKey);

  Optional<BillingKey> findActiveByWorkspaceId(Long workspaceId);
}
