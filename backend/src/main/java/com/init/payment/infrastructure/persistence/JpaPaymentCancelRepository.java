package com.init.payment.infrastructure.persistence;

import com.init.payment.domain.model.PaymentCancel;
import com.init.payment.domain.repository.PaymentCancelRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaPaymentCancelRepository
    extends JpaRepository<PaymentCancel, Long>, PaymentCancelRepository {

  @Override
  @Query(
      "SELECT COALESCE(SUM(pc.cancelAmount), 0)"
          + " FROM PaymentCancel pc WHERE pc.paymentId = :paymentId")
  long sumCancelAmountByPaymentId(@Param("paymentId") Long paymentId);
}
