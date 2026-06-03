package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.payment.application.exception.PaymentGatewayException;
import com.init.payment.application.port.BillingKeyCipher;
import com.init.payment.application.port.TossPaymentPort;
import com.init.payment.application.port.TossPaymentResult;
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
    given(paymentRepository.findBySubscriptionIdAndBillingPeriodKeyForUpdate(eq(5L), anyString()))
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

  @Test
  @DisplayName("구독 조회 결과가 없으면 청구를 건너뛴다")
  void subscriptionNotFound_skips() {
    Subscription stub = Subscription.create(1L, 10L);
    ReflectionTestUtils.setField(stub, "id", 5L);

    given(subscriptionRepository.findExpiringCancellations(any())).willReturn(List.of());
    given(subscriptionRepository.findChargeable(any())).willReturn(List.of(stub));
    given(subscriptionRepository.findRetryDue(any())).willReturn(List.of());
    given(subscriptionRepository.findById(5L)).willReturn(Optional.empty());

    service.run();

    verify(tossPaymentPort, never()).executeBilling(any());
  }

  @Test
  @DisplayName("CANCELED 구독은 청구를 건너뛴다")
  void canceledSubscription_skips() {
    OffsetDateTime start = OffsetDateTime.parse("2026-05-01T00:00:00Z");
    OffsetDateTime end = OffsetDateTime.parse("2026-06-01T00:00:00Z");
    Subscription subscription = Subscription.create(1L, 10L);
    subscription.assignCustomerKey("wsk_1_abc");
    subscription.activate(start, end, "wsk_1_abc");
    subscription.cancel();
    ReflectionTestUtils.setField(subscription, "id", 5L);

    given(subscriptionRepository.findExpiringCancellations(any())).willReturn(List.of());
    given(subscriptionRepository.findChargeable(any())).willReturn(List.of(subscription));
    given(subscriptionRepository.findRetryDue(any())).willReturn(List.of());
    given(subscriptionRepository.findById(5L)).willReturn(Optional.of(subscription));

    service.run();

    verify(tossPaymentPort, never()).executeBilling(any());
  }

  @Test
  @DisplayName("구독에 현재 주기 종료일이 없으면 청구를 건너뛴다")
  void periodStartNull_skips() {
    Subscription subscription = Subscription.create(1L, 10L);
    ReflectionTestUtils.setField(subscription, "id", 5L);
    ReflectionTestUtils.setField(subscription, "status", SubscriptionStatus.ACTIVE);

    given(subscriptionRepository.findExpiringCancellations(any())).willReturn(List.of());
    given(subscriptionRepository.findChargeable(any())).willReturn(List.of(subscription));
    given(subscriptionRepository.findRetryDue(any())).willReturn(List.of());
    given(subscriptionRepository.findById(5L)).willReturn(Optional.of(subscription));

    service.run();

    verify(tossPaymentPort, never()).executeBilling(any());
  }

  @Test
  @DisplayName("기간 결제가 이미 완료된 경우 재청구 없이 구독을 갱신한다")
  void existingDonePayment_renewsSubscription() {
    Subscription subscription = pastDueSubscription();
    Payment donePayment =
        Payment.createRecurring(
            1L, 5L, "ord_1", 29000, "KRW", "Pro", "2026-06-01T00:00:00Z", "idem");
    donePayment.complete("pay_1", "카드", OffsetDateTime.parse("2026-06-01T10:00:00Z"), "url", "{}");
    ReflectionTestUtils.setField(donePayment, "id", 7L);

    given(subscriptionRepository.findExpiringCancellations(any())).willReturn(List.of());
    given(subscriptionRepository.findChargeable(any())).willReturn(List.of());
    given(subscriptionRepository.findRetryDue(any())).willReturn(List.of(subscription));
    given(subscriptionRepository.findById(5L)).willReturn(Optional.of(subscription));
    given(subscriptionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan()));
    given(paymentRepository.findBySubscriptionIdAndBillingPeriodKeyForUpdate(eq(5L), anyString()))
        .willReturn(Optional.of(donePayment));

    service.run();

    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
    verify(tossPaymentPort, never()).executeBilling(any());
  }

  @Test
  @DisplayName("정기결제 성공 시 결제는 DONE, 구독은 ACTIVE로 갱신된다")
  void successfulCharge_completesPaymentAndRenews() {
    Subscription subscription = pastDueSubscription();
    Payment[] holder = new Payment[1];

    given(subscriptionRepository.findExpiringCancellations(any())).willReturn(List.of());
    given(subscriptionRepository.findChargeable(any())).willReturn(List.of());
    given(subscriptionRepository.findRetryDue(any())).willReturn(List.of(subscription));
    given(subscriptionRepository.findById(5L)).willReturn(Optional.of(subscription));
    given(subscriptionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan()));
    given(paymentRepository.findBySubscriptionIdAndBillingPeriodKeyForUpdate(eq(5L), anyString()))
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
        .willReturn(
            new TossPaymentResult(
                "pay_1",
                "ord_1",
                29000,
                "DONE",
                "카드",
                OffsetDateTime.parse("2026-06-01T10:00:00Z"),
                "https://receipt",
                null,
                "{\"status\":\"DONE\"}"));

    service.run();

    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
    assertThat(holder[0].getStatus()).isEqualTo(PaymentStatus.DONE);
  }

  @Test
  @DisplayName("기간말 해지 예약된 ACTIVE 구독은 해지된다")
  void cancelExpiring_cancelsScheduledSubscription() {
    OffsetDateTime start = OffsetDateTime.parse("2026-05-01T00:00:00Z");
    OffsetDateTime end = OffsetDateTime.parse("2026-06-01T00:00:00Z");
    Subscription subscription = Subscription.create(1L, 10L);
    subscription.assignCustomerKey("wsk_1_abc");
    subscription.activate(start, end, "wsk_1_abc");
    subscription.scheduleCancelAtPeriodEnd();
    ReflectionTestUtils.setField(subscription, "id", 5L);

    given(subscriptionRepository.findExpiringCancellations(any()))
        .willReturn(List.of(subscription));
    given(subscriptionRepository.findChargeable(any())).willReturn(List.of());
    given(subscriptionRepository.findRetryDue(any())).willReturn(List.of());
    given(subscriptionRepository.findById(5L)).willReturn(Optional.of(subscription));
    given(subscriptionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

    service.run();

    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.CANCELED);
  }

  @Test
  @DisplayName("동시 삽입 충돌 후 재조회 결과가 없으면 청구를 건너뛴다")
  void concurrentInsert_concurrentNull_skips() {
    Subscription subscription = pastDueSubscription();

    given(subscriptionRepository.findExpiringCancellations(any())).willReturn(List.of());
    given(subscriptionRepository.findChargeable(any())).willReturn(List.of());
    given(subscriptionRepository.findRetryDue(any())).willReturn(List.of(subscription));
    given(subscriptionRepository.findById(5L)).willReturn(Optional.of(subscription));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan()));
    given(paymentRepository.findBySubscriptionIdAndBillingPeriodKeyForUpdate(eq(5L), anyString()))
        .willReturn(Optional.empty());
    given(paymentRepository.save(any()))
        .willThrow(new org.springframework.dao.DataIntegrityViolationException("duplicate"));

    service.run();

    verify(tossPaymentPort, never()).executeBilling(any());
  }
}
