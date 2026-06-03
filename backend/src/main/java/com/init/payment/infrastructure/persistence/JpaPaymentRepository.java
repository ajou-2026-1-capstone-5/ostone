package com.init.payment.infrastructure.persistence;

import com.init.payment.domain.model.Payment;
import com.init.payment.domain.repository.PaymentRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaPaymentRepository extends JpaRepository<Payment, Long>, PaymentRepository {

  @Override
  Optional<Payment> findByOrderId(String orderId);

  @Override
  Optional<Payment> findByPaymentKey(String paymentKey);

  @Override
  Optional<Payment> findByPaymentKeyAndWorkspaceId(String paymentKey, Long workspaceId);

  @Override
  List<Payment> findByWorkspaceIdOrderByCreatedAtDesc(Long workspaceId);

  @Override
  Optional<Payment> findBySubscriptionIdAndBillingPeriodKey(
      Long subscriptionId, String billingPeriodKey);
}
