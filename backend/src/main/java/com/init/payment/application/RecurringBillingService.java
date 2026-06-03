package com.init.payment.application;

import com.init.payment.application.exception.BillingKeyNotFoundException;
import com.init.payment.application.exception.PaymentGatewayException;
import com.init.payment.application.exception.PaymentRejectedException;
import com.init.payment.application.exception.PlanNotFoundException;
import com.init.payment.application.port.BillingKeyCipher;
import com.init.payment.application.port.TossBillingExecuteCommand;
import com.init.payment.application.port.TossPaymentPort;
import com.init.payment.application.port.TossPaymentResult;
import com.init.payment.domain.model.BillingKey;
import com.init.payment.domain.model.Payment;
import com.init.payment.domain.model.Plan;
import com.init.payment.domain.model.Subscription;
import com.init.payment.domain.model.SubscriptionStatus;
import com.init.payment.domain.repository.BillingKeyRepository;
import com.init.payment.domain.repository.PaymentRepository;
import com.init.payment.domain.repository.PlanRepository;
import com.init.payment.domain.repository.SubscriptionRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 정기결제 실행 도메인 서비스. 만기 구독을 청구하고, 실패 시 PAST_DUE 전이 + 일 1회 재시도(최대 3일) 후 해지하며, 기간말 해지 예약을 처리한다 (U-004,
 * U-005). 동주기 중복청구는 payment 행 재사용 + DB unique 제약(subscription_id, billing_period_key)으로 차단한다
 * (U-011).
 */
@Service
public class RecurringBillingService {

  private static final Logger log = LoggerFactory.getLogger(RecurringBillingService.class);

  private final SubscriptionRepository subscriptionRepository;
  private final PlanRepository planRepository;
  private final PaymentRepository paymentRepository;
  private final BillingKeyRepository billingKeyRepository;
  private final TossPaymentPort tossPaymentPort;
  private final BillingKeyCipher billingKeyCipher;
  private final Clock clock;
  private final TransactionTemplate transactionTemplate;

  public RecurringBillingService(
      SubscriptionRepository subscriptionRepository,
      PlanRepository planRepository,
      PaymentRepository paymentRepository,
      BillingKeyRepository billingKeyRepository,
      TossPaymentPort tossPaymentPort,
      BillingKeyCipher billingKeyCipher,
      Clock clock,
      PlatformTransactionManager transactionManager) {
    this.subscriptionRepository = subscriptionRepository;
    this.planRepository = planRepository;
    this.paymentRepository = paymentRepository;
    this.billingKeyRepository = billingKeyRepository;
    this.tossPaymentPort = tossPaymentPort;
    this.billingKeyCipher = billingKeyCipher;
    this.clock = clock;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
  }

  public void run() {
    OffsetDateTime now = OffsetDateTime.now(clock);
    inTx(() -> subscriptionRepository.findExpiringCancellations(now)).stream()
        .map(Subscription::getId)
        .forEach(this::cancelExpiring);
    inTx(() -> subscriptionRepository.findChargeable(now)).stream()
        .map(Subscription::getId)
        .forEach(this::chargeSubscriptionSafely);
    inTx(() -> subscriptionRepository.findRetryDue(now)).stream()
        .map(Subscription::getId)
        .forEach(this::chargeSubscriptionSafely);
  }

  private void chargeSubscriptionSafely(Long subscriptionId) {
    try {
      chargeSubscription(subscriptionId);
    } catch (RuntimeException ex) {
      log.error("정기결제 처리 실패: subscriptionId={}", subscriptionId, ex);
    }
  }

  private void chargeSubscription(Long subscriptionId) {
    ChargePrep prep = inTx(() -> prepareCharge(subscriptionId));
    if (prep == null) {
      return;
    }

    boolean charged = false;
    TossPaymentResult result = null;
    try {
      BillingKey billingKey =
          billingKeyRepository
              .findActiveByWorkspaceId(prep.workspaceId())
              .orElseThrow(() -> new BillingKeyNotFoundException(prep.workspaceId()));
      String plainBillingKey = billingKeyCipher.decrypt(billingKey.getBillingKeyEncrypted());
      result =
          tossPaymentPort.executeBilling(
              new TossBillingExecuteCommand(
                  plainBillingKey,
                  prep.customerKey(),
                  prep.amount(),
                  prep.orderId(),
                  prep.orderName()));
      charged = result.isDone();
    } catch (BillingKeyNotFoundException | PaymentGatewayException | PaymentRejectedException ex) {
      log.warn("정기결제 청구 실패: subscriptionId={}, reason={}", subscriptionId, ex.getMessage());
    }

    boolean success = charged;
    TossPaymentResult tossResult = result;
    inTxRun(() -> finalizeCharge(subscriptionId, prep, success, tossResult));
  }

  private ChargePrep prepareCharge(Long subscriptionId) {
    Subscription subscription = subscriptionRepository.findById(subscriptionId).orElse(null);
    if (subscription == null || subscription.getStatus() == SubscriptionStatus.CANCELED) {
      return null;
    }
    OffsetDateTime periodStart = subscription.getCurrentPeriodEnd();
    if (periodStart == null) {
      log.warn("구독에 현재 주기 정보가 없어 정기결제를 건너뜁니다. subscriptionId={}", subscriptionId);
      return null;
    }
    Plan plan = requirePlan(subscription.getPlanId());
    OffsetDateTime periodEnd = plan.getBillingInterval().advance(periodStart);
    String periodKey = PaymentIdentifiers.periodKey(periodStart);

    Payment existing =
        paymentRepository
            .findBySubscriptionIdAndBillingPeriodKey(subscriptionId, periodKey)
            .orElse(null);
    if (existing != null && existing.isDone()) {
      subscription.renew(periodStart, periodEnd);
      subscriptionRepository.save(subscription);
      return null;
    }

    Payment payment = existing;
    if (payment == null) {
      try {
        payment =
            paymentRepository.save(
                Payment.createRecurring(
                    subscription.getWorkspaceId(),
                    subscriptionId,
                    PaymentIdentifiers.orderId(),
                    plan.getAmount(),
                    plan.getCurrency(),
                    plan.getName(),
                    periodKey,
                    PaymentIdentifiers.idempotencyKey()));
      } catch (DataIntegrityViolationException ex) {
        Payment concurrent =
            paymentRepository
                .findBySubscriptionIdAndBillingPeriodKey(subscriptionId, periodKey)
                .orElse(null);
        if (concurrent == null || concurrent.isDone()) {
          return null;
        }
        payment = concurrent;
      }
    }

    return new ChargePrep(
        payment.getId(),
        payment.getOrderId(),
        subscription.getWorkspaceId(),
        subscription.getCustomerKey(),
        plan.getAmount(),
        plan.getName(),
        periodStart,
        periodEnd);
  }

  private void finalizeCharge(
      Long subscriptionId, ChargePrep prep, boolean success, TossPaymentResult result) {
    Subscription subscription = subscriptionRepository.findById(subscriptionId).orElse(null);
    Payment payment = paymentRepository.findById(prep.paymentId()).orElse(null);
    if (subscription == null || payment == null) {
      return;
    }
    if (success) {
      payment.complete(
          result.paymentKey(),
          result.method(),
          result.approvedAt() != null ? result.approvedAt() : OffsetDateTime.now(clock),
          result.receiptUrl(),
          result.maskedRawJson());
      subscription.renew(prep.periodStart(), prep.periodEnd());
    } else {
      payment.markAborted(result != null ? result.maskedRawJson() : null);
      subscription.markPastDue(OffsetDateTime.now(clock).plusDays(1));
      if (subscription.isRetryExhausted()) {
        subscription.cancel();
      }
    }
    paymentRepository.save(payment);
    subscriptionRepository.save(subscription);
  }

  private void cancelExpiring(Long subscriptionId) {
    inTxRun(
        () -> {
          Subscription subscription = subscriptionRepository.findById(subscriptionId).orElse(null);
          if (subscription == null) {
            return;
          }
          if (subscription.isCancelAtPeriodEnd()
              && subscription.getStatus() == SubscriptionStatus.ACTIVE) {
            subscription.cancel();
            subscriptionRepository.save(subscription);
          }
        });
  }

  private Plan requirePlan(Long planId) {
    return planRepository
        .findById(planId)
        .orElseThrow(() -> new PlanNotFoundException("id=" + planId));
  }

  private <T> T inTx(Supplier<T> callback) {
    return transactionTemplate.execute(status -> callback.get());
  }

  private void inTxRun(Runnable callback) {
    transactionTemplate.executeWithoutResult(status -> callback.run());
  }

  private record ChargePrep(
      Long paymentId,
      String orderId,
      Long workspaceId,
      String customerKey,
      long amount,
      String orderName,
      OffsetDateTime periodStart,
      OffsetDateTime periodEnd) {}
}
