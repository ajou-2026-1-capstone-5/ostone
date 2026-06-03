package com.init.payment.infrastructure.persistence;

import com.init.payment.domain.model.PaymentCancel;
import com.init.payment.domain.repository.PaymentCancelRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaPaymentCancelRepository
    extends JpaRepository<PaymentCancel, Long>, PaymentCancelRepository {}
