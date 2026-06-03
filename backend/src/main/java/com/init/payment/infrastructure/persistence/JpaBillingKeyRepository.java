package com.init.payment.infrastructure.persistence;

import com.init.payment.domain.model.BillingKey;
import com.init.payment.domain.model.BillingKeyStatus;
import com.init.payment.domain.repository.BillingKeyRepository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaBillingKeyRepository
    extends JpaRepository<BillingKey, Long>, BillingKeyRepository {

  @Override
  default Optional<BillingKey> findActiveByWorkspaceId(Long workspaceId) {
    return findFirstByWorkspaceIdAndStatusOrderByIdDesc(workspaceId, BillingKeyStatus.ACTIVE);
  }

  Optional<BillingKey> findFirstByWorkspaceIdAndStatusOrderByIdDesc(
      Long workspaceId, BillingKeyStatus status);
}
