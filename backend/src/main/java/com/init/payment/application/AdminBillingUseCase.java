package com.init.payment.application;

import com.init.payment.application.exception.PaymentExceptions;
import com.init.payment.application.gateway.TossCancelResult;
import com.init.payment.application.gateway.TossPaymentGateway;
import com.init.payment.domain.model.Payment;
import com.init.payment.domain.model.PaymentCancel;
import com.init.payment.domain.model.PaymentStatus;
import com.init.payment.domain.repository.PaymentCancelRepository;
import com.init.payment.domain.repository.PaymentRepository;
import java.util.List;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AdminBillingUseCase {

  private final AdminBillingQueryRepository queryRepository;
  private final PaymentRepository paymentRepository;
  private final PaymentCancelRepository paymentCancelRepository;
  private final TossPaymentGateway tossPaymentGateway;

  public AdminBillingUseCase(
      AdminBillingQueryRepository queryRepository,
      PaymentRepository paymentRepository,
      PaymentCancelRepository paymentCancelRepository,
      TossPaymentGateway tossPaymentGateway) {
    this.queryRepository = queryRepository;
    this.paymentRepository = paymentRepository;
    this.paymentCancelRepository = paymentCancelRepository;
    this.tossPaymentGateway = tossPaymentGateway;
  }

  public List<AdminBillingCustomerSummary> findCustomerSummaries() {
    return queryRepository.findCustomerSummaries();
  }

  @Transactional
  public AdminBillingRefundResult refundFull(AdminBillingRefundCommand command) {
    Payment payment =
        paymentRepository
            .findByIdForUpdate(command.paymentId())
            .orElseThrow(() -> PaymentExceptions.notFound("결제 건을 찾을 수 없습니다."));
    if (paymentCancelRepository.existsByPaymentId(payment.getId())) {
      throw PaymentExceptions.alreadyRefunded("이미 환불 기록이 있는 결제입니다.");
    }
    if (payment.getStatus() != PaymentStatus.DONE) {
      throw PaymentExceptions.notRefundable("결제 완료 상태의 건만 전체 환불할 수 있습니다.");
    }
    if (isBlank(payment.getPaymentKey())) {
      throw PaymentExceptions.notRefundable("환불을 실행할 결제 키가 없습니다.");
    }

    TossCancelResult tossResult =
        tossPaymentGateway.cancelPayment(
            payment.getPaymentKey(), command.reason(), refundIdempotencyKey(payment));
    PaymentCancel cancel =
        payment.refundFull(command.reason(), tossResult.transactionKey(), tossResult.canceledAt());
    paymentCancelRepository.save(cancel);

    return new AdminBillingRefundResult(
        payment.getId(),
        payment.getWorkspaceId(),
        cancel.getCancelAmount(),
        payment.getStatus(),
        cancel.getTransactionKey(),
        cancel.getCanceledAt(),
        cancel.getReason());
  }

  private boolean isBlank(@Nullable String value) {
    return value == null || value.isBlank();
  }

  private String refundIdempotencyKey(Payment payment) {
    Long paymentId = payment.getId();
    if (paymentId == null) {
      throw PaymentExceptions.notRefundable("환불 대상 결제 식별자가 없습니다.");
    }
    return "admin-full-refund-" + paymentId;
  }
}
