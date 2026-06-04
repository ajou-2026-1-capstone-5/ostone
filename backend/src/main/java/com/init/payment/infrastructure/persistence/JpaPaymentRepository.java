package com.init.payment.infrastructure.persistence;

import com.init.payment.domain.model.Payment;
import com.init.payment.domain.repository.PaymentRepository;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaPaymentRepository extends JpaRepository<Payment, Long>, PaymentRepository {

  @Override
  Optional<Payment> findByOrderId(String orderId);

  @Override
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT p FROM Payment p WHERE p.id = :id")
  Optional<Payment> findByIdForUpdate(@Param("id") Long id);

  @Override
  Optional<Payment> findByWorkspaceIdAndOrderId(Long workspaceId, String orderId);

  @Override
  Optional<Payment> findByPaymentKey(String paymentKey);

  @Override
  Optional<Payment> findByPaymentKeyAndWorkspaceId(String paymentKey, Long workspaceId);

  @Override
  List<Payment> findByWorkspaceIdOrderByCreatedAtDesc(Long workspaceId);

  @Override
  Optional<Payment> findBySubscriptionIdAndBillingPeriodKey(
      Long subscriptionId, String billingPeriodKey);

  @Override
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      "SELECT p FROM Payment p WHERE p.subscriptionId = :subscriptionId"
          + " AND p.billingPeriodKey = :billingPeriodKey")
  Optional<Payment> findBySubscriptionIdAndBillingPeriodKeyForUpdate(
      @Param("subscriptionId") Long subscriptionId,
      @Param("billingPeriodKey") String billingPeriodKey);
}
