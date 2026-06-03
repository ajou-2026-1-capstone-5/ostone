package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.payment.application.exception.PaymentWebhookUnauthorizedException;
import com.init.payment.application.port.TossPaymentPort;
import com.init.payment.application.port.TossPaymentResult;
import com.init.payment.domain.model.Payment;
import com.init.payment.domain.model.PaymentStatus;
import com.init.payment.domain.model.WebhookEvent;
import com.init.payment.domain.repository.PaymentRepository;
import com.init.payment.domain.repository.WebhookEventRepository;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("PaymentWebhookService")
class PaymentWebhookServiceTest {

  private static final String SECRET = "test-toss-webhook-secret";

  @Mock private WebhookEventRepository webhookEventRepository;
  @Mock private PaymentRepository paymentRepository;
  @Mock private TossPaymentPort tossPaymentPort;
  @Mock private PlatformTransactionManager transactionManager;

  private PaymentWebhookService service;

  private final Clock clock = Clock.fixed(Instant.parse("2026-06-01T00:00:00Z"), ZoneOffset.UTC);

  @BeforeEach
  void setUp() {
    service =
        new PaymentWebhookService(
            webhookEventRepository,
            paymentRepository,
            tossPaymentPort,
            SECRET,
            clock,
            transactionManager);
  }

  @Test
  @DisplayName("시크릿 헤더가 불일치하면 PaymentWebhookUnauthorizedException을 던진다")
  void invalidSecret_throws() {
    assertThatThrownBy(
            () ->
                service.handle(
                    new HandleTossWebhookCommand(
                        "wrong", "txn_1", "PAYMENT_STATUS", "pay_1", "{}")))
        .isInstanceOf(PaymentWebhookUnauthorizedException.class);
    verify(tossPaymentPort, never()).getPayment(any());
  }

  @Test
  @DisplayName("이미 처리된 transmission_id는 멱등하게 재처리하지 않는다 (U-003)")
  void alreadyProcessed_isIdempotent() {
    WebhookEvent processed = WebhookEvent.received("txn_1", "PAYMENT_STATUS", "{}");
    processed.markProcessed(OffsetDateTime.now(clock));
    given(webhookEventRepository.findByTransmissionId("txn_1")).willReturn(Optional.of(processed));

    service.handle(new HandleTossWebhookCommand(SECRET, "txn_1", "PAYMENT_STATUS", "pay_1", "{}"));

    verify(tossPaymentPort, never()).getPayment(any());
  }

  @Test
  @DisplayName("유효한 웹훅은 Toss 재조회 후 권위 상태를 결제에 반영한다 (U-003)")
  void validWebhook_reflectsAuthoritativeStatus() {
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());
    given(webhookEventRepository.findByTransmissionId("txn_1")).willReturn(Optional.empty());
    Payment payment =
        Payment.createRecurring(
            1L, 5L, "ord_1", 29000, "KRW", "Pro", "2026-06-01T00:00:00Z", "idem");
    given(paymentRepository.findByPaymentKey("pay_1")).willReturn(Optional.of(payment));
    given(tossPaymentPort.getPayment("pay_1"))
        .willReturn(
            new TossPaymentResult(
                "pay_1",
                "ord_1",
                29000,
                "DONE",
                "카드",
                OffsetDateTime.now(clock),
                "https://receipt",
                null,
                "{\"status\":\"DONE\"}"));

    service.handle(new HandleTossWebhookCommand(SECRET, "txn_1", "PAYMENT_STATUS", "pay_1", "{}"));

    assertThat(payment.getStatus()).isEqualTo(PaymentStatus.DONE);
    verify(paymentRepository).save(payment);
  }

  @Test
  @DisplayName("paymentKey가 null이면 Toss 재조회를 건너뛴다")
  void nullPaymentKey_skips_toss_call() {
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());
    given(webhookEventRepository.findByTransmissionId("txn_2")).willReturn(Optional.empty());

    service.handle(new HandleTossWebhookCommand(SECRET, "txn_2", "PAYMENT_STATUS", null, "{}"));

    verify(tossPaymentPort, never()).getPayment(any());
  }

  @Test
  @DisplayName("paymentKey가 공백이면 Toss 재조회를 건너뛴다")
  void blankPaymentKey_skips_toss_call() {
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());
    given(webhookEventRepository.findByTransmissionId("txn_3")).willReturn(Optional.empty());

    service.handle(new HandleTossWebhookCommand(SECRET, "txn_3", "PAYMENT_STATUS", "  ", "{}"));

    verify(tossPaymentPort, never()).getPayment(any());
  }

  @Test
  @DisplayName("Toss 재조회 결과가 CANCELED이면 결제를 취소로 반영한다")
  void canceledStatus_marks_payment_canceled() {
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());
    given(webhookEventRepository.findByTransmissionId("txn_4")).willReturn(Optional.empty());
    Payment payment =
        Payment.createRecurring(
            1L, 5L, "ord_1", 29000, "KRW", "Pro", "2026-06-01T00:00:00Z", "idem");
    payment.complete("pay_1", "카드", OffsetDateTime.now(clock), "url", "{}");
    given(paymentRepository.findByPaymentKey("pay_1")).willReturn(Optional.of(payment));
    given(tossPaymentPort.getPayment("pay_1"))
        .willReturn(
            new TossPaymentResult(
                "pay_1", "ord_1", 29000, "CANCELED", null, null, null, "txn_c", "{}"));

    service.handle(new HandleTossWebhookCommand(SECRET, "txn_4", "PAYMENT_STATUS", "pay_1", "{}"));

    assertThat(payment.getStatus()).isEqualTo(PaymentStatus.CANCELED);
    verify(paymentRepository).save(payment);
  }

  @Test
  @DisplayName("Toss 재조회 결과가 PARTIAL_CANCELED이면 결제를 부분취소로 반영한다")
  void partialCanceledStatus_marks_payment_partial_canceled() {
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());
    given(webhookEventRepository.findByTransmissionId("txn_5")).willReturn(Optional.empty());
    Payment payment =
        Payment.createRecurring(
            1L, 5L, "ord_1", 29000, "KRW", "Pro", "2026-06-01T00:00:00Z", "idem");
    payment.complete("pay_1", "카드", OffsetDateTime.now(clock), "url", "{}");
    given(paymentRepository.findByPaymentKey("pay_1")).willReturn(Optional.of(payment));
    given(tossPaymentPort.getPayment("pay_1"))
        .willReturn(
            new TossPaymentResult(
                "pay_1", "ord_1", 15000, "PARTIAL_CANCELED", null, null, null, "txn_pc", "{}"));

    service.handle(new HandleTossWebhookCommand(SECRET, "txn_5", "PAYMENT_STATUS", "pay_1", "{}"));

    assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PARTIAL_CANCELED);
    verify(paymentRepository).save(payment);
  }

  @Test
  @DisplayName("Payment DB 미존재 시 markProcessed를 건너뛴다 — Toss 재시도 허용 (V-EC-001)")
  void paymentNotFound_skips_markProcessed() {
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());
    given(webhookEventRepository.findByTransmissionId("txn_nr")).willReturn(Optional.empty());
    given(paymentRepository.findByPaymentKey("pay_nr")).willReturn(Optional.empty());
    given(tossPaymentPort.getPayment("pay_nr"))
        .willReturn(
            new TossPaymentResult("pay_nr", "ord_nr", 29000, "DONE", null, null, null, null, "{}"));

    service.handle(
        new HandleTossWebhookCommand(SECRET, "txn_nr", "PAYMENT_STATUS", "pay_nr", "{}"));

    verify(webhookEventRepository, never())
        .findByTransmissionId(org.mockito.ArgumentMatchers.eq("txn_nr__processed"));
  }

  @Test
  @DisplayName("빈 문자열 시크릿으로 구성된 서비스는 모든 웹훅을 거절한다")
  void emptyConfiguredSecret_throws_unauthorized() {
    PaymentWebhookService serviceWithEmptySecret =
        new PaymentWebhookService(
            webhookEventRepository,
            paymentRepository,
            tossPaymentPort,
            "",
            clock,
            transactionManager);

    assertThatThrownBy(
            () ->
                serviceWithEmptySecret.handle(
                    new HandleTossWebhookCommand(
                        "any-secret", "txn_6", "PAYMENT_STATUS", "pay_1", "{}")))
        .isInstanceOf(PaymentWebhookUnauthorizedException.class);
  }
}
