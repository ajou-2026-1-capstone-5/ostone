package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.payment.application.exception.PaymentAmountMismatchException;
import com.init.payment.application.port.TossPaymentPort;
import com.init.payment.application.port.TossPaymentResult;
import com.init.payment.domain.model.BillingInterval;
import com.init.payment.domain.model.Payment;
import com.init.payment.domain.model.Plan;
import com.init.payment.domain.model.Subscription;
import com.init.payment.domain.repository.PaymentCancelRepository;
import com.init.payment.domain.repository.PaymentRepository;
import com.init.payment.domain.repository.PlanRepository;
import com.init.payment.domain.repository.SubscriptionRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("PaymentService")
class PaymentServiceTest {

  @Mock private PaymentRepository paymentRepository;
  @Mock private PaymentCancelRepository paymentCancelRepository;
  @Mock private SubscriptionRepository subscriptionRepository;
  @Mock private PlanRepository planRepository;
  @Mock private TossPaymentPort tossPaymentPort;
  @Mock private PaymentAccessGuard accessGuard;
  @Mock private org.springframework.transaction.PlatformTransactionManager transactionManager;

  private PaymentService paymentService;

  private final Clock clock = Clock.fixed(Instant.parse("2026-06-01T00:00:00Z"), ZoneOffset.UTC);

  @BeforeEach
  void setUp() {
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());
    paymentService =
        new PaymentService(
            paymentRepository,
            paymentCancelRepository,
            subscriptionRepository,
            planRepository,
            tossPaymentPort,
            accessGuard,
            clock,
            transactionManager);
  }

  @Test
  @DisplayName("금액이 일치하면 Toss confirm 후 DONE으로 기록하고 구독을 활성화한다")
  void confirm_success() {
    Subscription subscription = subscription(5L, 10L);
    Plan plan = plan(10L, 29000);
    given(subscriptionRepository.findCurrentByWorkspaceId(1L))
        .willReturn(Optional.of(subscription));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan));
    given(paymentRepository.findByOrderId("ord_1")).willReturn(Optional.empty());
    given(subscriptionRepository.findById(5L)).willReturn(Optional.of(subscription));
    given(paymentRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(tossPaymentPort.confirmPayment("pay_1", "ord_1", 29000))
        .willReturn(doneResult("pay_1", "ord_1", 29000));

    PaymentResult result =
        paymentService.confirmPayment(new ConfirmPaymentCommand(1L, 99L, "pay_1", "ord_1", 29000));

    assertThat(result.status()).isEqualTo("DONE");
    assertThat(subscription.isActive()).isTrue();
  }

  @Test
  @DisplayName("금액이 다르면 PaymentAmountMismatchException을 던지고 Toss를 호출하지 않는다")
  void confirm_amountMismatch() {
    Subscription subscription = subscription(5L, 10L);
    given(subscriptionRepository.findCurrentByWorkspaceId(1L))
        .willReturn(Optional.of(subscription));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan(10L, 29000)));
    given(paymentRepository.findByOrderId("ord_1")).willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                paymentService.confirmPayment(
                    new ConfirmPaymentCommand(1L, 99L, "pay_1", "ord_1", 10000)))
        .isInstanceOf(PaymentAmountMismatchException.class);

    verify(tossPaymentPort, never()).confirmPayment(any(), any(), anyLong());
  }

  @Test
  @DisplayName("이미 완료된 주문은 멱등하게 기존 결제를 반환하고 Toss를 재호출하지 않는다")
  void confirm_idempotent() {
    Subscription subscription = subscription(5L, 10L);
    Payment done = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    done.complete("pay_1", "카드", OffsetDateTime.now(clock), null, "{}");
    given(subscriptionRepository.findCurrentByWorkspaceId(1L))
        .willReturn(Optional.of(subscription));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan(10L, 29000)));
    given(paymentRepository.findByOrderId("ord_1")).willReturn(Optional.of(done));

    PaymentResult result =
        paymentService.confirmPayment(new ConfirmPaymentCommand(1L, 99L, "pay_1", "ord_1", 29000));

    assertThat(result.status()).isEqualTo("DONE");
    verify(tossPaymentPort, never()).confirmPayment(any(), any(), anyLong());
  }

  @Test
  @DisplayName("부분 취소 시 PARTIAL_CANCELED로 기록하고 취소 내역을 저장한다")
  void cancel_partial() {
    Payment payment = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    payment.complete("pay_1", "카드", OffsetDateTime.now(clock), null, "{}");
    ReflectionTestUtils.setField(payment, "id", 7L);
    given(paymentRepository.findByPaymentKeyAndWorkspaceId("pay_1", 1L))
        .willReturn(Optional.of(payment));
    given(paymentRepository.findById(7L)).willReturn(Optional.of(payment));
    given(paymentRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(tossPaymentPort.cancelPayment("pay_1", "고객 요청", 10000L))
        .willReturn(partialCanceledResult());

    PaymentResult result =
        paymentService.cancelPayment(new CancelPaymentCommand(1L, 99L, "pay_1", "고객 요청", 10000L));

    assertThat(result.status()).isEqualTo("PARTIAL_CANCELED");
    verify(paymentCancelRepository).save(any());
  }

  private Subscription subscription(Long id, Long planId) {
    Subscription subscription = Subscription.create(1L, planId);
    subscription.assignCustomerKey("wsk_1_abc");
    ReflectionTestUtils.setField(subscription, "id", id);
    return subscription;
  }

  private Plan plan(Long id, long amount) {
    Plan plan = Plan.create("pro_monthly", "Pro", amount, "KRW", BillingInterval.MONTH);
    ReflectionTestUtils.setField(plan, "id", id);
    return plan;
  }

  private TossPaymentResult doneResult(String paymentKey, String orderId, long amount) {
    return new TossPaymentResult(
        paymentKey,
        orderId,
        amount,
        "DONE",
        "카드",
        OffsetDateTime.now(clock),
        "https://receipt",
        null,
        "{\"status\":\"DONE\"}");
  }

  private TossPaymentResult partialCanceledResult() {
    return new TossPaymentResult(
        "pay_1",
        "ord_1",
        29000,
        "PARTIAL_CANCELED",
        "카드",
        OffsetDateTime.now(clock),
        null,
        "txn_1",
        "{\"status\":\"PARTIAL_CANCELED\"}");
  }
}
