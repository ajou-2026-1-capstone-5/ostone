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
import java.util.function.Supplier;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class AdminBillingUseCase {

  private final AdminBillingQueryRepository queryRepository;
  private final PaymentRepository paymentRepository;
  private final PaymentCancelRepository paymentCancelRepository;
  private final TossPaymentGateway tossPaymentGateway;
  private final TransactionTemplate transactionTemplate;

  public AdminBillingUseCase(
      AdminBillingQueryRepository queryRepository,
      PaymentRepository paymentRepository,
      PaymentCancelRepository paymentCancelRepository,
      TossPaymentGateway tossPaymentGateway,
      PlatformTransactionManager transactionManager) {
    this.queryRepository = queryRepository;
    this.paymentRepository = paymentRepository;
    this.paymentCancelRepository = paymentCancelRepository;
    this.tossPaymentGateway = tossPaymentGateway;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
    this.transactionTemplate.setReadOnly(false);
  }

  public List<AdminBillingCustomerSummary> findCustomerSummaries() {
    return queryRepository.findCustomerSummaries();
  }

  public AdminBillingRefundResult refundFull(AdminBillingRefundCommand command) {
    RefundContext context = inTx(() -> prepareRefund(command.paymentId()));

    TossCancelResult tossResult =
        tossPaymentGateway.cancelPayment(
            context.paymentKey(), command.reason(), context.idempotencyKey());

    return inTx(() -> finalizeRefund(context, command.reason(), tossResult));
  }

  private RefundContext prepareRefund(Long paymentId) {
    Payment payment =
        paymentRepository
            .findByIdForUpdate(paymentId)
            .orElseThrow(() -> PaymentExceptions.notFound("결제 건을 찾을 수 없습니다."));
    validateRefundable(payment);
    return new RefundContext(
        payment.getId(), payment.getPaymentKey(), refundIdempotencyKey(payment));
  }

  private AdminBillingRefundResult finalizeRefund(
      RefundContext context, String reason, TossCancelResult tossResult) {
    Payment payment =
        paymentRepository
            .findByIdForUpdate(context.paymentId())
            .orElseThrow(() -> PaymentExceptions.notFound("결제 건을 찾을 수 없습니다."));
    validateRefundable(payment);
    if (!context.paymentKey().equals(payment.getPaymentKey())) {
      throw PaymentExceptions.notRefundable("환불 대상 결제 키가 변경되었습니다.");
    }

    PaymentCancel cancel =
        payment.refundFull(reason, tossResult.transactionKey(), tossResult.canceledAt());
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

  private void validateRefundable(Payment payment) {
    if (paymentCancelRepository.existsByPaymentId(payment.getId())) {
      throw PaymentExceptions.alreadyRefunded("이미 환불 기록이 있는 결제입니다.");
    }
    if (payment.getStatus() != PaymentStatus.DONE) {
      throw PaymentExceptions.notRefundable("결제 완료 상태의 건만 전체 환불할 수 있습니다.");
    }
    if (isBlank(payment.getPaymentKey())) {
      throw PaymentExceptions.notRefundable("환불을 실행할 결제 키가 없습니다.");
    }
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

  private <T> T inTx(Supplier<T> callback) {
    return transactionTemplate.execute(status -> callback.get());
  }

  private record RefundContext(Long paymentId, String paymentKey, String idempotencyKey) {}
}
