package com.init.payment.domain.repository;

import com.init.payment.domain.model.PaymentCancel;

public interface PaymentCancelRepository {

  PaymentCancel save(PaymentCancel paymentCancel);

  /** 결제의 이미 취소된 합계를 반환한다. 없으면 0. */
  long sumCancelAmountByPaymentId(Long paymentId);
}
