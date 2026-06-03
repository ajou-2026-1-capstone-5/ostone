package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

import com.init.payment.application.exception.PaymentGatewayException;
import com.init.payment.application.port.BillingKeyCipher;
import com.init.payment.application.port.TossPaymentPort;
import com.init.payment.domain.model.BillingInterval;
import com.init.payment.domain.model.BillingKey;
import com.init.payment.domain.model.Payment;
import com.init.payment.domain.model.PaymentStatus;
import com.init.payment.domain.model.Plan;
import com.init.payment.domain.model.Subscription;
import com.init.payment.domain.model.SubscriptionStatus;
import com.init.payment.domain.repository.BillingKeyRepository;
import com.init.payment.domain.repository.PaymentRepository;
import com.init.payment.domain.repository.PlanRepository;
import com.init.payment.domain.repository.SubscriptionRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("RecurringBillingService")
class RecurringBillingServiceTest {

  @Mock private SubscriptionRepository subscriptionRepository;
  @Mock private PlanRepository planRepository;
  @Mock private PaymentRepository paymentRepository;
  @Mock private BillingKeyRepository billingKeyRepository;
  @Mock private TossPaymentPort tossPaymentPort;
  @Mock private BillingKeyCipher billingKeyCipher;
  @Mock private PlatformTransactionManager transactionManager;

  private RecurringBillingService service;

  private final Clock clock = Clock.fixed(Instant.parse("2026-06-01T00:00:00Z"), ZoneOffset.UTC);

  @BeforeEach
  void setUp() {
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());
    service =
        new RecurringBillingService(
            subscriptionRepository,
            planRepository,
            paymentRepository,
            billingKeyRepository,
            tossPaymentPort,
            billingKeyCipher,
            clock,
            transactionManager);
  }

  @Test
  @DisplayName("재시도 4회차 실패 시 결제는 ABORTED, 구독은 CANCELED로 전이한다 (U-004)")
  void retryExhausted_cancelsSubscription() {
    Subscription subscription = pastDueSubscription();
    Payment[] holder = new Payment[1];

    given(subscriptionRepository.findExpiringCancellations(any())).willReturn(List.of());
    given(subscriptionRepository.findChargeable(any())).willReturn(List.of());
    given(subscriptionRepository.findRetryDue(any())).willReturn(List.of(subscription));
    given(subscriptionRepository.findById(5L)).willReturn(Optional.of(subscription));
    given(subscriptionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan()));
    given(paymentRepository.findBySubscriptionIdAndBillingPeriodKey(eq(5L), anyString()))
        .willReturn(Optional.empty());
    given(paymentRepository.save(any()))
        .willAnswer(
            inv -> {
              Payment payment = inv.getArgument(0);
              if (payment.getId() == null) {
                ReflectionTestUtils.setField(payment, "id", 7L);
              }
              holder[0] = payment;
              return payment;
            });
    given(paymentRepository.findById(7L)).willAnswer(inv -> Optional.ofNullable(holder[0]));
    given(billingKeyRepository.findActiveByWorkspaceId(1L)).willReturn(Optional.of(billingKey()));
    given(billingKeyCipher.decrypt(any())).willReturn("bk_plain");
    given(tossPaymentPort.executeBilling(any()))
        .willThrow(new PaymentGatewayException("gateway down"));

    service.run();

    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.CANCELED);
    assertThat(subscription.getFailedAttemptCount()).isEqualTo(4);
    assertThat(holder[0].getStatus()).isEqualTo(PaymentStatus.ABORTED);
  }

  private Subscription pastDueSubscription() {
    OffsetDateTime start = OffsetDateTime.parse("2026-05-01T00:00:00Z");
    OffsetDateTime end = OffsetDateTime.parse("2026-06-01T00:00:00Z");
    Subscription subscription = Subscription.create(1L, 10L);
    subscription.assignCustomerKey("wsk_1_abc");
    subscription.activate(start, end, "wsk_1_abc");
    subscription.markPastDue(end.plusDays(1));
    subscription.markPastDue(end.plusDays(2));
    subscription.markPastDue(end.plusDays(3));
    ReflectionTestUtils.setField(subscription, "id", 5L);
    return subscription;
  }

  private Plan plan() {
    Plan plan = Plan.create("pro_monthly", "Pro", 29000, "KRW", BillingInterval.MONTH);
    ReflectionTestUtils.setField(plan, "id", 10L);
    return plan;
  }

  private BillingKey billingKey() {
    return BillingKey.create(1L, "wsk_1_abc", new byte[] {1, 2, 3}, "신한", "1234-****-****-5678");
  }
}
