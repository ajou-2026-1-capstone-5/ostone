package com.init.payment.domain.repository;

import com.init.payment.domain.model.PaymentCancel;

public interface PaymentCancelRepository {

  PaymentCancel save(PaymentCancel paymentCancel);
}
