package com.init.payment.domain.repository;

import com.init.payment.domain.model.Payment;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository {

  Payment save(Payment payment);

  Optional<Payment> findById(Long id);

  Optional<Payment> findByOrderId(String orderId);

  Optional<Payment> findByPaymentKey(String paymentKey);

  Optional<Payment> findByPaymentKeyAndWorkspaceId(String paymentKey, Long workspaceId);

  List<Payment> findByWorkspaceIdOrderByCreatedAtDesc(Long workspaceId);

  /** 동일 주기 결제를 찾는다. 존재 시 재시도는 해당 행을 재사용하여 중복청구를 방지한다 (U-011). */
  Optional<Payment> findBySubscriptionIdAndBillingPeriodKey(
      Long subscriptionId, String billingPeriodKey);
}
