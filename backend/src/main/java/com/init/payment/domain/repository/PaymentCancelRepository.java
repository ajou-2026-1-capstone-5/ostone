package com.init.payment.domain.repository;

import com.init.payment.domain.model.PaymentCancel;
import java.util.Optional;

public interface PaymentCancelRepository {

  PaymentCancel save(PaymentCancel paymentCancel);

  /** 결제의 이미 취소된 합계를 반환한다. 없으면 0. */
  long sumCancelAmountByPaymentId(Long paymentId);

  /** 동일 (paymentId, cancelAmount)의 가장 최근 취소 내역을 조회한다. 재시도 시 idempotencyKey 재사용 목적. */
  Optional<PaymentCancel> findFirstByPaymentIdAndCancelAmountOrderByIdDesc(
      Long paymentId, long cancelAmount);
}
