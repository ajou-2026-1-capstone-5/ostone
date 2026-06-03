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
import com.init.payment.infrastructure.config.TossApiProperties;
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
    TossApiProperties properties =
        new TossApiProperties(null, new TossApiProperties.Webhook(SECRET), "enc");
    service =
        new PaymentWebhookService(
            webhookEventRepository,
            paymentRepository,
            tossPaymentPort,
            properties,
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
}
