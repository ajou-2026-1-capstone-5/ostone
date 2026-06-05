package com.init.payment.application;

import com.init.payment.application.exception.PaymentAmountMismatchException;
import com.init.payment.application.exception.PaymentCancelNotAllowedException;
import com.init.payment.application.exception.PaymentNotFoundException;
import com.init.payment.application.exception.PlanNotFoundException;
import com.init.payment.application.exception.SubscriptionNotFoundException;
import com.init.payment.application.port.TossPaymentPort;
import com.init.payment.application.port.TossPaymentResult;
import com.init.payment.domain.model.Payment;
import com.init.payment.domain.model.PaymentCancel;
import com.init.payment.domain.model.PaymentStatus;
import com.init.payment.domain.model.Plan;
import com.init.payment.domain.model.Subscription;
import com.init.payment.domain.model.SubscriptionStatus;
import com.init.payment.domain.repository.PaymentCancelRepository;
import com.init.payment.domain.repository.PaymentRepository;
import com.init.payment.domain.repository.PlanRepository;
import com.init.payment.domain.repository.SubscriptionRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 일회성 결제 confirm(금액검증 + 멱등), 결제 내역 조회, 취소/부분환불.
 *
 * <p>NOTE: confirm은 Toss 호출과 DB 갱신을 interleave하므로 TransactionTemplate으로 2-phase 처리한다. 취소는 잔여 취소 가능
 * 금액 계산과 저장을 같은 payment 행 잠금 안에서 직렬화한다.
 */
@Service
public class PaymentService {

  private final PaymentRepository paymentRepository;
  private final PaymentCancelRepository paymentCancelRepository;
  private final SubscriptionRepository subscriptionRepository;
  private final PlanRepository planRepository;
  private final TossPaymentPort tossPaymentPort;
  private final PaymentAccessGuard accessGuard;
  private final Clock clock;
  private final TransactionTemplate transactionTemplate;

  public PaymentService(
      PaymentRepository paymentRepository,
      PaymentCancelRepository paymentCancelRepository,
      SubscriptionRepository subscriptionRepository,
      PlanRepository planRepository,
      TossPaymentPort tossPaymentPort,
      PaymentAccessGuard accessGuard,
      Clock clock,
      PlatformTransactionManager transactionManager) {
    this.paymentRepository = paymentRepository;
    this.paymentCancelRepository = paymentCancelRepository;
    this.subscriptionRepository = subscriptionRepository;
    this.planRepository = planRepository;
    this.tossPaymentPort = tossPaymentPort;
    this.accessGuard = accessGuard;
    this.clock = clock;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
  }

  public PaymentResult confirmPayment(ConfirmPaymentCommand command) {
    accessGuard.requireMember(command.workspaceId(), command.userId());

    ConfirmContext context =
        inTx(
            () -> {
              Subscription subscription =
                  subscriptionRepository
                      .findCurrentByWorkspaceId(command.workspaceId())
                      .orElseThrow(() -> new SubscriptionNotFoundException(command.workspaceId()));
              Plan plan = requirePlan(subscription.getPlanId());
              Payment existing =
                  paymentRepository
                      .findByWorkspaceIdAndOrderId(command.workspaceId(), command.orderId())
                      .orElse(null);
              if (existing != null && existing.isDone()) {
                return new ConfirmContext(existing, plan, subscription.getId(), true);
              }
              long expected = existing != null ? existing.getAmount() : plan.getAmount();
              if (command.amount() != expected) {
                throw new PaymentAmountMismatchException(expected, command.amount());
              }
              return new ConfirmContext(existing, plan, subscription.getId(), false);
            });

    if (context.idempotentHit()) {
      return PaymentResult.from(context.existing());
    }

    TossPaymentResult result =
        tossPaymentPort.confirmPayment(command.paymentKey(), command.orderId(), command.amount());

    Payment finalized =
        inTx(
            () -> {
              Payment payment =
                  paymentRepository
                      .findByWorkspaceIdAndOrderId(command.workspaceId(), command.orderId())
                      .orElseGet(
                          () ->
                              Payment.createOrder(
                                  command.workspaceId(),
                                  context.subscriptionId(),
                                  command.orderId(),
                                  command.amount(),
                                  context.plan().getCurrency(),
                                  context.plan().getName()));
              if (payment.isDone()) {
                return payment;
              }
              if (result.isDone()) {
                payment.complete(
                    command.paymentKey(),
                    result.method(),
                    approvedAt(result),
                    result.receiptUrl(),
                    result.maskedRawJson());
                activateSubscription(context.subscriptionId(), context.plan());
              } else {
                payment.markAborted(result.maskedRawJson());
              }
              return savePayment(payment, command.workspaceId(), command.orderId());
            });

    return PaymentResult.from(finalized);
  }

  @Transactional(readOnly = true)
  public List<PaymentResult> getPayments(Long workspaceId, Long userId) {
    accessGuard.requireMember(workspaceId, userId);
    return paymentRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId).stream()
        .map(PaymentResult::from)
        .toList();
  }

  public PaymentResult cancelPayment(CancelPaymentCommand command) {
    accessGuard.requireMember(command.workspaceId(), command.userId());

    Payment finalized =
        inTx(
            () -> {
              Payment payment =
                  paymentRepository
                      .findByPaymentKeyAndWorkspaceIdForUpdate(
                          command.paymentKey(), command.workspaceId())
                      .orElseThrow(
                          () -> new PaymentNotFoundException("paymentKey=" + command.paymentKey()));
              String cancelIdempotencyKey = cancelIdempotencyKey(command);
              if (hasText(cancelIdempotencyKey)
                  && paymentCancelRepository
                      .findByPaymentIdAndIdempotencyKey(payment.getId(), cancelIdempotencyKey)
                      .isPresent()) {
                return payment;
              }
              if (!isCancelable(payment)) {
                throw new PaymentCancelNotAllowedException(
                    "취소할 수 없는 결제 상태입니다. status=" + payment.getStatus());
              }

              long alreadyCanceled =
                  paymentCancelRepository.sumCancelAmountByPaymentId(payment.getId());
              long remainingCancelable = payment.getAmount() - alreadyCanceled;
              long resolvedCancelAmount = resolveCancelAmount(command, remainingCancelable);

              TossPaymentResult result =
                  tossPaymentPort.cancelPayment(
                      command.paymentKey(),
                      command.cancelReason(),
                      command.cancelAmount(),
                      cancelIdempotencyKey);
              paymentCancelRepository.save(
                  PaymentCancel.create(
                      payment.getId(),
                      resolvedCancelAmount,
                      command.cancelReason(),
                      result.transactionKey(),
                      cancelIdempotencyKey));
              long canceledTotal = alreadyCanceled + resolvedCancelAmount;
              if (isPartialCancel(result, canceledTotal, payment.getAmount())) {
                payment.markPartialCanceled(result.maskedRawJson());
              } else {
                payment.markCanceled(result.maskedRawJson());
              }
              return paymentRepository.save(payment);
            });

    return PaymentResult.from(finalized);
  }

  private long resolveCancelAmount(CancelPaymentCommand command, long remainingCancelable) {
    if (remainingCancelable <= 0) {
      throw new PaymentCancelNotAllowedException("취소 가능한 금액이 없습니다.");
    }
    if (command.cancelAmount() == null) {
      return remainingCancelable;
    }
    if (command.cancelAmount() <= 0 || command.cancelAmount() > remainingCancelable) {
      throw new PaymentCancelNotAllowedException(
          "취소 금액이 유효하지 않습니다. cancelAmount="
              + command.cancelAmount()
              + ", remainingCancelable="
              + remainingCancelable);
    }
    return command.cancelAmount();
  }

  private String cancelIdempotencyKey(CancelPaymentCommand command) {
    if (hasText(command.cancelIdempotencyKey())) {
      return command.cancelIdempotencyKey().trim();
    }
    return PaymentIdentifiers.idempotencyKey();
  }

  private void activateSubscription(Long subscriptionId, Plan plan) {
    Subscription subscription =
        subscriptionRepository
            .findById(subscriptionId)
            .orElseThrow(() -> new SubscriptionNotFoundException(subscriptionId));
    if (subscription.getStatus() == SubscriptionStatus.CANCELED || subscription.isActive()) {
      return;
    }
    OffsetDateTime periodStart = OffsetDateTime.now(clock);
    OffsetDateTime periodEnd = plan.getBillingInterval().advance(periodStart);
    subscription.activate(periodStart, periodEnd, subscription.getCustomerKey());
    subscriptionRepository.save(subscription);
  }

  private Payment savePayment(Payment payment, Long workspaceId, String orderId) {
    try {
      return paymentRepository.save(payment);
    } catch (DataIntegrityViolationException ex) {
      return paymentRepository
          .findByWorkspaceIdAndOrderId(workspaceId, orderId)
          .orElseThrow(() -> ex);
    }
  }

  private boolean isCancelable(Payment payment) {
    return payment.getStatus() == PaymentStatus.DONE
        || payment.getStatus() == PaymentStatus.PARTIAL_CANCELED;
  }

  private boolean isPartialCancel(TossPaymentResult result, long canceledTotal, long totalAmount) {
    if (result.isPartialCanceled()) {
      return true;
    }
    if (result.isCanceled()) {
      return false;
    }
    return canceledTotal < totalAmount;
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  private OffsetDateTime approvedAt(TossPaymentResult result) {
    return result.approvedAt() != null ? result.approvedAt() : OffsetDateTime.now(clock);
  }

  private Plan requirePlan(Long planId) {
    return planRepository
        .findById(planId)
        .orElseThrow(() -> new PlanNotFoundException("id=" + planId));
  }

  private <T> T inTx(Supplier<T> callback) {
    return transactionTemplate.execute(status -> callback.get());
  }

  private record ConfirmContext(
      Payment existing, Plan plan, Long subscriptionId, boolean idempotentHit) {}
}
