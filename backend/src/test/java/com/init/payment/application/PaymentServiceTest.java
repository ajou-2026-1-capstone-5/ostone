package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.init.payment.application.exception.PaymentAmountMismatchException;
import com.init.payment.application.exception.PaymentCancelNotAllowedException;
import com.init.payment.application.exception.PaymentNotFoundException;
import com.init.payment.application.port.TossPaymentPort;
import com.init.payment.application.port.TossPaymentResult;
import com.init.payment.domain.model.BillingInterval;
import com.init.payment.domain.model.Payment;
import com.init.payment.domain.model.PaymentCancel;
import com.init.payment.domain.model.Plan;
import com.init.payment.domain.model.Subscription;
import com.init.payment.domain.repository.PaymentCancelRepository;
import com.init.payment.domain.repository.PaymentRepository;
import com.init.payment.domain.repository.PlanRepository;
import com.init.payment.domain.repository.SubscriptionRepository;
import com.init.testsupport.PersistenceTestFixtures;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.ReentrantLock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
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
    lenient()
        .when(transactionManager.getTransaction(any()))
        .thenReturn(new SimpleTransactionStatus());
    lenient()
        .when(paymentCancelRepository.findByPaymentIdAndIdempotencyKey(anyLong(), any()))
        .thenReturn(Optional.empty());
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
    given(paymentRepository.findByWorkspaceIdAndOrderId(1L, "ord_1")).willReturn(Optional.empty());
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
    given(paymentRepository.findByWorkspaceIdAndOrderId(1L, "ord_1")).willReturn(Optional.empty());

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
    given(paymentRepository.findByWorkspaceIdAndOrderId(1L, "ord_1")).willReturn(Optional.of(done));

    PaymentResult result =
        paymentService.confirmPayment(new ConfirmPaymentCommand(1L, 99L, "pay_1", "ord_1", 29000));

    assertThat(result.status()).isEqualTo("DONE");
    verify(tossPaymentPort, never()).confirmPayment(any(), any(), anyLong());
  }

  @Test
  @DisplayName("전액 취소 시 CANCELED로 기록한다")
  void cancel_full() {
    Payment payment = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    payment.complete("pay_1", "카드", OffsetDateTime.now(clock), null, "{}");
    PersistenceTestFixtures.assignGeneratedId(payment, 7L);
    given(paymentRepository.findByPaymentKeyAndWorkspaceIdForUpdate("pay_1", 1L))
        .willReturn(Optional.of(payment));
    given(paymentRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(tossPaymentPort.cancelPayment(eq("pay_1"), eq("전액취소"), isNull(), any()))
        .willReturn(canceledResult());

    PaymentResult result =
        paymentService.cancelPayment(
            new CancelPaymentCommand(1L, 99L, "pay_1", "전액취소", null, "idem-full-1"));

    assertThat(result.status()).isEqualTo("CANCELED");
    verify(paymentCancelRepository).save(any());
  }

  @Test
  @DisplayName("잔여 취소 가능 금액 초과 시 PaymentCancelNotAllowedException을 던진다 (V-NEW-002)")
  void cancel_exceedsRemaining_throws() {
    Payment payment = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    payment.complete("pay_1", "카드", OffsetDateTime.now(clock), null, "{}");
    PersistenceTestFixtures.assignGeneratedId(payment, 7L);
    given(paymentRepository.findByPaymentKeyAndWorkspaceIdForUpdate("pay_1", 1L))
        .willReturn(Optional.of(payment));
    given(paymentCancelRepository.sumCancelAmountByPaymentId(7L)).willReturn(15000L);

    assertThatThrownBy(
            () ->
                paymentService.cancelPayment(
                    new CancelPaymentCommand(1L, 99L, "pay_1", "고객요청", 20000L, "idem-ex-1")))
        .isInstanceOf(PaymentCancelNotAllowedException.class);
    verify(tossPaymentPort, never()).cancelPayment(any(), any(), any(), any());
  }

  @Test
  @DisplayName("취소 가능 금액이 남지 않으면 Toss를 호출하지 않는다")
  void cancel_noRemaining_throws() {
    Payment payment = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    payment.complete("pay_1", "카드", OffsetDateTime.now(clock), null, "{}");
    payment.markPartialCanceled("{}");
    PersistenceTestFixtures.assignGeneratedId(payment, 7L);
    given(paymentRepository.findByPaymentKeyAndWorkspaceIdForUpdate("pay_1", 1L))
        .willReturn(Optional.of(payment));
    given(paymentCancelRepository.sumCancelAmountByPaymentId(7L)).willReturn(29000L);

    assertThatThrownBy(
            () ->
                paymentService.cancelPayment(
                    new CancelPaymentCommand(1L, 99L, "pay_1", "고객요청", null, "idem-none-1")))
        .isInstanceOf(PaymentCancelNotAllowedException.class);
    verify(tossPaymentPort, never()).cancelPayment(any(), any(), any(), any());
  }

  @Test
  @DisplayName("취소 idempotency key가 없으면 서비스가 생성한 key로 Toss 요청과 취소 내역 저장을 수행한다")
  void cancel_missingIdempotencyKey_generatesKey() {
    Payment payment = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    payment.complete("pay_1", "카드", OffsetDateTime.now(clock), null, "{}");
    PersistenceTestFixtures.assignGeneratedId(payment, 7L);
    given(paymentRepository.findByPaymentKeyAndWorkspaceIdForUpdate("pay_1", 1L))
        .willReturn(Optional.of(payment));
    given(paymentRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(tossPaymentPort.cancelPayment(eq("pay_1"), eq("고객 요청"), eq(10000L), any()))
        .willReturn(partialCanceledResult());

    PaymentResult result =
        paymentService.cancelPayment(
            new CancelPaymentCommand(1L, 99L, "pay_1", "고객 요청", 10000L, null));

    ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
    verify(tossPaymentPort)
        .cancelPayment(eq("pay_1"), eq("고객 요청"), eq(10000L), keyCaptor.capture());
    ArgumentCaptor<PaymentCancel> cancelCaptor = ArgumentCaptor.forClass(PaymentCancel.class);
    verify(paymentCancelRepository).save(cancelCaptor.capture());
    assertThat(keyCaptor.getValue()).isNotBlank();
    assertThat(cancelCaptor.getValue().getIdempotencyKey()).isEqualTo(keyCaptor.getValue());
    assertThat(result.status()).isEqualTo("PARTIAL_CANCELED");
  }

  @Test
  @DisplayName("취소할 수 없는 결제 상태이면 Toss를 호출하지 않는다")
  void cancel_nonCancelableStatus_throws() {
    Payment payment = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    PersistenceTestFixtures.assignGeneratedId(payment, 7L);
    given(paymentRepository.findByPaymentKeyAndWorkspaceIdForUpdate("pay_1", 1L))
        .willReturn(Optional.of(payment));

    assertThatThrownBy(
            () ->
                paymentService.cancelPayment(
                    new CancelPaymentCommand(1L, 99L, "pay_1", "고객요청", null, "idem-ready-1")))
        .isInstanceOf(PaymentCancelNotAllowedException.class);
    verify(tossPaymentPort, never()).cancelPayment(any(), any(), any(), any());
  }

  @Test
  @DisplayName("결제를 찾을 수 없으면 cancelPayment 시 PaymentNotFoundException을 던진다")
  void cancel_paymentNotFound_throws() {
    given(paymentRepository.findByPaymentKeyAndWorkspaceIdForUpdate("pay_x", 1L))
        .willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                paymentService.cancelPayment(
                    new CancelPaymentCommand(1L, 99L, "pay_x", "고객요청", null, "idem-notfound-1")))
        .isInstanceOf(PaymentNotFoundException.class);
  }

  @Test
  @DisplayName("confirmPayment 동시삽입 충돌 시 DataIntegrityViolationException → 기존 레코드 반환")
  void confirm_concurrentInsert_fallsBackToExisting() {
    Subscription subscription = subscription(5L, 10L);
    Plan plan = plan(10L, 29000);
    Payment existing = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    existing.complete("pay_1", "카드", OffsetDateTime.now(clock), null, "{}");

    given(subscriptionRepository.findCurrentByWorkspaceId(1L))
        .willReturn(Optional.of(subscription));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan));
    // first inTx, second inTx orElseGet, savePayment catch block
    given(paymentRepository.findByWorkspaceIdAndOrderId(1L, "ord_1"))
        .willReturn(Optional.empty())
        .willReturn(Optional.empty())
        .willReturn(Optional.of(existing));
    given(subscriptionRepository.findById(5L)).willReturn(Optional.of(subscription));
    given(tossPaymentPort.confirmPayment("pay_1", "ord_1", 29000))
        .willReturn(doneResult("pay_1", "ord_1", 29000));
    given(paymentRepository.save(any()))
        .willThrow(new DataIntegrityViolationException("duplicate key"));

    PaymentResult result =
        paymentService.confirmPayment(new ConfirmPaymentCommand(1L, 99L, "pay_1", "ord_1", 29000));

    assertThat(result.status()).isEqualTo("DONE");
  }

  @Test
  @DisplayName("결제 목록 조회 시 해당 워크스페이스 결제만 반환한다")
  void getPayments_returnsWorkspacePayments() {
    Payment payment = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    payment.complete("pay_1", "카드", OffsetDateTime.now(clock), null, "{}");
    given(paymentRepository.findByWorkspaceIdOrderByCreatedAtDesc(1L))
        .willReturn(java.util.List.of(payment));

    java.util.List<PaymentResult> results = paymentService.getPayments(1L, 99L);

    assertThat(results).hasSize(1);
    assertThat(results.get(0).status()).isEqualTo("DONE");
  }

  @Test
  @DisplayName("부분 취소 시 PARTIAL_CANCELED로 기록하고 취소 내역을 저장한다")
  void cancel_partial() {
    Payment payment = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    payment.complete("pay_1", "카드", OffsetDateTime.now(clock), null, "{}");
    PersistenceTestFixtures.assignGeneratedId(payment, 7L);
    given(paymentRepository.findByPaymentKeyAndWorkspaceIdForUpdate("pay_1", 1L))
        .willReturn(Optional.of(payment));
    given(paymentRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(tossPaymentPort.cancelPayment(eq("pay_1"), eq("고객 요청"), eq(10000L), any()))
        .willReturn(partialCanceledResult());

    PaymentResult result =
        paymentService.cancelPayment(
            new CancelPaymentCommand(1L, 99L, "pay_1", "고객 요청", 10000L, "idem-partial-1"));

    assertThat(result.status()).isEqualTo("PARTIAL_CANCELED");
    verify(paymentCancelRepository).save(any());
  }

  @Test
  @DisplayName("같은 idempotency key 재시도는 Toss 재호출과 취소 내역 중복 저장 없이 기존 결제를 반환한다")
  void cancel_sameIdempotencyKey_returnsExistingPayment() {
    Payment payment = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    payment.complete("pay_1", "카드", OffsetDateTime.now(clock), null, "{}");
    payment.markPartialCanceled("{}");
    PersistenceTestFixtures.assignGeneratedId(payment, 7L);
    PaymentCancel existingCancel = PaymentCancel.create(7L, 10000L, "고객 요청", "txn_1", "idem-dup-1");
    given(paymentRepository.findByPaymentKeyAndWorkspaceIdForUpdate("pay_1", 1L))
        .willReturn(Optional.of(payment));
    given(paymentCancelRepository.findByPaymentIdAndIdempotencyKey(7L, "idem-dup-1"))
        .willReturn(Optional.of(existingCancel));

    PaymentResult result =
        paymentService.cancelPayment(
            new CancelPaymentCommand(1L, 99L, "pay_1", "고객 요청", 10000L, "idem-dup-1"));

    assertThat(result.status()).isEqualTo("PARTIAL_CANCELED");
    verify(tossPaymentPort, never()).cancelPayment(any(), any(), any(), any());
    verify(paymentCancelRepository, never()).save(any());
  }

  @Test
  @DisplayName("부분 취소 후 전액 취소는 남은 금액만 기록하고 CANCELED로 전이한다")
  void cancel_fullAfterPartial_savesRemainingAmount() {
    Payment payment = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    payment.complete("pay_1", "카드", OffsetDateTime.now(clock), null, "{}");
    payment.markPartialCanceled("{}");
    PersistenceTestFixtures.assignGeneratedId(payment, 7L);
    given(paymentRepository.findByPaymentKeyAndWorkspaceIdForUpdate("pay_1", 1L))
        .willReturn(Optional.of(payment));
    given(paymentCancelRepository.sumCancelAmountByPaymentId(7L)).willReturn(10000L);
    given(paymentRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(tossPaymentPort.cancelPayment(eq("pay_1"), eq("남은 금액 취소"), isNull(), any()))
        .willReturn(canceledResult());

    PaymentResult result =
        paymentService.cancelPayment(
            new CancelPaymentCommand(1L, 99L, "pay_1", "남은 금액 취소", null, "idem-remain-1"));

    ArgumentCaptor<PaymentCancel> cancelCaptor = ArgumentCaptor.forClass(PaymentCancel.class);
    verify(paymentCancelRepository).save(cancelCaptor.capture());
    assertThat(cancelCaptor.getValue().getCancelAmount()).isEqualTo(19000L);
    assertThat(result.status()).isEqualTo("CANCELED");
  }

  @Test
  @DisplayName("동시 부분 취소는 결제 행 잠금으로 직렬화되어 잔여 금액 초과 요청 하나만 거부한다")
  void cancel_concurrentPartial_excessRejected() throws Exception {
    ReentrantLock txLock = new ReentrantLock();
    given(transactionManager.getTransaction(any()))
        .willAnswer(
            invocation -> {
              txLock.lock();
              return new SimpleTransactionStatus();
            });
    doAnswer(
            invocation -> {
              txLock.unlock();
              return null;
            })
        .when(transactionManager)
        .commit(any());
    doAnswer(
            invocation -> {
              txLock.unlock();
              return null;
            })
        .when(transactionManager)
        .rollback(any());

    Payment payment = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    payment.complete("pay_1", "카드", OffsetDateTime.now(clock), null, "{}");
    PersistenceTestFixtures.assignGeneratedId(payment, 7L);
    AtomicLong canceledTotal = new AtomicLong(0);
    given(paymentRepository.findByPaymentKeyAndWorkspaceIdForUpdate("pay_1", 1L))
        .willReturn(Optional.of(payment));
    given(paymentCancelRepository.sumCancelAmountByPaymentId(7L))
        .willAnswer(invocation -> canceledTotal.get());
    given(paymentCancelRepository.save(any()))
        .willAnswer(
            invocation -> {
              PaymentCancel cancel = invocation.getArgument(0);
              canceledTotal.addAndGet(cancel.getCancelAmount());
              return cancel;
            });
    given(paymentRepository.save(any())).willAnswer(invocation -> invocation.getArgument(0));
    given(tossPaymentPort.cancelPayment(eq("pay_1"), eq("고객 요청"), eq(20000L), any()))
        .willReturn(partialCanceledResult());

    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);
    ExecutorService executor = Executors.newFixedThreadPool(2);

    try {
      List<Future<CancelAttempt>> futures =
          List.of(
              executor.submit(cancelAttempt(ready, start)),
              executor.submit(cancelAttempt(ready, start)));

      assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
      start.countDown();

      List<CancelAttempt> attempts =
          futures.stream().map(PaymentServiceTest::getCancelAttempt).toList();

      assertThat(attempts.stream().filter(CancelAttempt::succeeded).count()).isEqualTo(1);
      assertThat(attempts.stream().filter(CancelAttempt::failedWithCancelNotAllowed).count())
          .isEqualTo(1);
      assertThat(canceledTotal.get()).isEqualTo(20000L);
      verify(tossPaymentPort, times(1)).cancelPayment(eq("pay_1"), eq("고객 요청"), eq(20000L), any());
      verify(paymentCancelRepository, times(1)).save(any());
    } finally {
      executor.shutdownNow();
    }
  }

  private Callable<CancelAttempt> cancelAttempt(CountDownLatch ready, CountDownLatch start) {
    return () -> {
      ready.countDown();
      if (!start.await(5, TimeUnit.SECONDS)) {
        throw new IllegalStateException("cancel attempts were not released");
      }
      try {
        return CancelAttempt.success(
            paymentService.cancelPayment(
                new CancelPaymentCommand(
                    1L, 99L, "pay_1", "고객 요청", 20000L, PaymentIdentifiers.idempotencyKey())));
      } catch (RuntimeException ex) {
        return CancelAttempt.failure(ex);
      }
    };
  }

  private static CancelAttempt getCancelAttempt(Future<CancelAttempt> future) {
    try {
      return future.get(10, TimeUnit.SECONDS);
    } catch (Exception ex) {
      throw new IllegalStateException("cancel attempt did not finish", ex);
    }
  }

  private record CancelAttempt(PaymentResult result, Throwable failure) {
    static CancelAttempt success(PaymentResult result) {
      return new CancelAttempt(result, null);
    }

    static CancelAttempt failure(Throwable failure) {
      return new CancelAttempt(null, failure);
    }

    boolean succeeded() {
      return result != null && failure == null;
    }

    boolean failedWithCancelNotAllowed() {
      return failure instanceof PaymentCancelNotAllowedException;
    }
  }

  private Subscription subscription(Long id, Long planId) {
    Subscription subscription = Subscription.create(1L, planId);
    subscription.assignCustomerKey("wsk_1_abc");
    PersistenceTestFixtures.assignGeneratedId(subscription, id);
    return subscription;
  }

  private Plan plan(Long id, long amount) {
    Plan plan = Plan.create("pro_monthly", "Pro", amount, "KRW", BillingInterval.MONTH);
    PersistenceTestFixtures.assignGeneratedId(plan, id);
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

  private TossPaymentResult canceledResult() {
    return new TossPaymentResult(
        "pay_1",
        "ord_1",
        29000,
        "CANCELED",
        "카드",
        OffsetDateTime.now(clock),
        null,
        "txn_1",
        "{\"status\":\"CANCELED\"}");
  }
}
