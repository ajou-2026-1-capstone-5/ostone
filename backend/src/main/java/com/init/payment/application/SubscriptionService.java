package com.init.payment.application;

import com.init.payment.application.exception.ActiveSubscriptionExistsException;
import com.init.payment.application.exception.PlanNotFoundException;
import com.init.payment.application.exception.SubscriptionNotFoundException;
import com.init.payment.application.port.BillingKeyCipher;
import com.init.payment.application.port.TossBillingExecuteCommand;
import com.init.payment.application.port.TossBillingKeyResult;
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
import com.init.shared.application.exception.BadRequestException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 구독 생성/조회/취소 및 billingKey 발급 기반 구독 활성화.
 *
 * <p>NOTE: 외부 Toss 호출과 DB 갱신을 interleave하는 issueBillingKey는 선언적 @Transactional 대신
 * TransactionTemplate으로 2-phase 처리한다(트랜잭션 내 외부 HTTP 호출 회피, pipelinejob 패턴 미러).
 */
@Service
public class SubscriptionService {

  private static final String OPEN_SUBSCRIPTION_UNIQUE_INDEX =
      "uq_payment_subscription_workspace_open";

  private final SubscriptionRepository subscriptionRepository;
  private final PlanRepository planRepository;
  private final BillingKeyRepository billingKeyRepository;
  private final PaymentRepository paymentRepository;
  private final TossPaymentPort tossPaymentPort;
  private final BillingKeyCipher billingKeyCipher;
  private final PaymentAccessGuard accessGuard;
  private final Clock clock;
  private final TransactionTemplate transactionTemplate;

  public SubscriptionService(
      SubscriptionRepository subscriptionRepository,
      PlanRepository planRepository,
      BillingKeyRepository billingKeyRepository,
      PaymentRepository paymentRepository,
      TossPaymentPort tossPaymentPort,
      BillingKeyCipher billingKeyCipher,
      PaymentAccessGuard accessGuard,
      Clock clock,
      PlatformTransactionManager transactionManager) {
    this.subscriptionRepository = subscriptionRepository;
    this.planRepository = planRepository;
    this.billingKeyRepository = billingKeyRepository;
    this.paymentRepository = paymentRepository;
    this.tossPaymentPort = tossPaymentPort;
    this.billingKeyCipher = billingKeyCipher;
    this.accessGuard = accessGuard;
    this.clock = clock;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
  }

  @Transactional
  public SubscriptionResult createSubscription(CreateSubscriptionCommand command) {
    accessGuard.requireMember(command.workspaceId(), command.userId());
    Plan plan =
        planRepository
            .findByPlanKey(command.planKey())
            .orElseThrow(() -> new PlanNotFoundException(command.planKey()));

    if (plan.isContactOnly()) {
      throw new BadRequestException("PLAN_CONTACT_ONLY", "도입 문의가 필요한 요금제입니다. 별도 연락처로 문의해 주세요.");
    }

    subscriptionRepository
        .findCurrentByWorkspaceId(command.workspaceId())
        .ifPresent(
            existing -> {
              throw new ActiveSubscriptionExistsException(command.workspaceId());
            });

    Subscription subscription = Subscription.create(command.workspaceId(), plan.getId());
    subscription.assignCustomerKey(PaymentIdentifiers.customerKey(command.workspaceId()));
    Subscription saved = saveNewSubscription(subscription, command.workspaceId());
    return SubscriptionResult.from(saved, plan);
  }

  @Transactional(readOnly = true)
  public SubscriptionResult getSubscription(Long workspaceId, Long userId) {
    accessGuard.requireMember(workspaceId, userId);
    Subscription subscription =
        subscriptionRepository
            .findCurrentByWorkspaceId(workspaceId)
            .orElseThrow(() -> new SubscriptionNotFoundException(workspaceId));
    Plan plan = requirePlan(subscription.getPlanId());
    return SubscriptionResult.from(subscription, plan);
  }

  /** 구독 취소. INCOMPLETE는 즉시 해지, 그 외는 기간말 해지 예약 (U-005). */
  @Transactional
  public SubscriptionResult cancelSubscription(Long workspaceId, Long userId) {
    accessGuard.requireMember(workspaceId, userId);
    Subscription subscription =
        subscriptionRepository
            .findCurrentByWorkspaceId(workspaceId)
            .orElseThrow(() -> new SubscriptionNotFoundException(workspaceId));

    if (subscription.getStatus() == SubscriptionStatus.INCOMPLETE) {
      subscription.cancel();
    } else {
      subscription.scheduleCancelAtPeriodEnd();
    }
    Subscription saved = subscriptionRepository.save(subscription);
    return SubscriptionResult.from(saved, requirePlan(saved.getPlanId()));
  }

  /** billingKey 발급 + 첫 정기결제 + 구독 활성화 (Sequence 1). */
  public BillingAuthorizationResult issueBillingKey(IssueBillingKeyCommand command) {
    accessGuard.requireMember(command.workspaceId(), command.userId());

    Subscription subscription =
        inTx(
            () ->
                subscriptionRepository
                    .findCurrentByWorkspaceId(command.workspaceId())
                    .orElseThrow(() -> new SubscriptionNotFoundException(command.workspaceId())));
    if (subscription.getStatus() != SubscriptionStatus.INCOMPLETE) {
      throw new ActiveSubscriptionExistsException(command.workspaceId());
    }
    Plan plan = requirePlan(subscription.getPlanId());
    String customerKey = subscription.getCustomerKey();

    TossBillingKeyResult issued = tossPaymentPort.issueBillingKey(command.authKey(), customerKey);
    byte[] encrypted = billingKeyCipher.encrypt(issued.billingKey());

    BillingKey billingKey =
        inTx(
            () ->
                billingKeyRepository.save(
                    BillingKey.create(
                        command.workspaceId(),
                        customerKey,
                        encrypted,
                        issued.cardCompany(),
                        issued.cardNumberMasked())));

    OffsetDateTime periodStart = OffsetDateTime.now(clock);
    OffsetDateTime periodEnd = plan.getBillingInterval().advance(periodStart);
    String orderId = PaymentIdentifiers.orderId();
    String periodKey = PaymentIdentifiers.periodKey(periodStart);

    TossPaymentResult charge =
        tossPaymentPort.executeBilling(
            new TossBillingExecuteCommand(
                issued.billingKey(), customerKey, plan.getAmount(), orderId, plan.getName()));

    Subscription activated =
        inTx(
            () -> {
              Subscription current =
                  subscriptionRepository
                      .findById(subscription.getId())
                      .orElseThrow(() -> new SubscriptionNotFoundException(command.workspaceId()));
              Payment payment =
                  Payment.createRecurring(
                      command.workspaceId(),
                      current.getId(),
                      orderId,
                      plan.getAmount(),
                      plan.getCurrency(),
                      plan.getName(),
                      periodKey,
                      PaymentIdentifiers.idempotencyKey());
              if (charge.isDone()) {
                payment.complete(
                    charge.paymentKey(),
                    charge.method(),
                    chargeApprovedAt(charge),
                    charge.receiptUrl(),
                    charge.maskedRawJson());
                current.activate(periodStart, periodEnd, customerKey);
              } else {
                payment.markAborted(charge.maskedRawJson());
              }
              paymentRepository.save(payment);
              return subscriptionRepository.save(current);
            });

    return new BillingAuthorizationResult(
        SubscriptionResult.from(activated, plan), BillingKeySummary.from(billingKey));
  }

  private OffsetDateTime chargeApprovedAt(TossPaymentResult charge) {
    return charge.approvedAt() != null ? charge.approvedAt() : OffsetDateTime.now(clock);
  }

  private Plan requirePlan(Long planId) {
    return planRepository
        .findById(planId)
        .orElseThrow(() -> new PlanNotFoundException("id=" + planId));
  }

  private <T> T inTx(Supplier<T> callback) {
    return transactionTemplate.execute(status -> callback.get());
  }

  private Subscription saveNewSubscription(Subscription subscription, Long workspaceId) {
    try {
      return subscriptionRepository.save(subscription);
    } catch (DataIntegrityViolationException ex) {
      if (isOpenSubscriptionUniqueIndexViolation(ex)) {
        throw new ActiveSubscriptionExistsException(workspaceId, ex);
      }
      throw ex;
    }
  }

  private boolean isOpenSubscriptionUniqueIndexViolation(DataIntegrityViolationException ex) {
    Throwable cause = ex.getCause();
    if (cause instanceof org.hibernate.exception.ConstraintViolationException violationException) {
      String constraintName = violationException.getConstraintName();
      return constraintName != null && constraintName.contains(OPEN_SUBSCRIPTION_UNIQUE_INDEX);
    }

    String message = ex.getMostSpecificCause().getMessage();
    return message != null && message.contains(OPEN_SUBSCRIPTION_UNIQUE_INDEX);
  }
}
