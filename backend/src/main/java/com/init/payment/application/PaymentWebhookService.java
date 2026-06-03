package com.init.payment.application;

import com.init.payment.application.exception.PaymentWebhookUnauthorizedException;
import com.init.payment.application.port.TossPaymentPort;
import com.init.payment.application.port.TossPaymentResult;
import com.init.payment.domain.model.Payment;
import com.init.payment.domain.model.WebhookEvent;
import com.init.payment.domain.repository.PaymentRepository;
import com.init.payment.domain.repository.WebhookEventRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Toss 웹훅 처리 (U-003). 시크릿 헤더 상수시간 비교 -> transmission_id 멱등 -> 본문 무신뢰, Toss 재조회로 권위 상태 확정 -> Payment
 * 상태 반영.
 */
@Service
public class PaymentWebhookService {

  private static final Logger log = LoggerFactory.getLogger(PaymentWebhookService.class);

  private final WebhookEventRepository webhookEventRepository;
  private final PaymentRepository paymentRepository;
  private final TossPaymentPort tossPaymentPort;
  private final String webhookSecret;
  private final Clock clock;
  private final TransactionTemplate transactionTemplate;

  public PaymentWebhookService(
      WebhookEventRepository webhookEventRepository,
      PaymentRepository paymentRepository,
      TossPaymentPort tossPaymentPort,
      @Value("${toss.webhook.secret:}") String webhookSecret,
      Clock clock,
      PlatformTransactionManager transactionManager) {
    this.webhookEventRepository = webhookEventRepository;
    this.paymentRepository = paymentRepository;
    this.tossPaymentPort = tossPaymentPort;
    this.webhookSecret = webhookSecret;
    this.clock = clock;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
  }

  public void handle(HandleTossWebhookCommand command) {
    validateSecret(command.secretHeader());

    WebhookEvent existing =
        webhookEventRepository.findByTransmissionId(command.transmissionId()).orElse(null);
    if (existing != null && existing.isProcessed()) {
      return;
    }
    ensureReceived(command);

    boolean paymentFound = true;
    if (command.paymentKey() != null && !command.paymentKey().isBlank()) {
      TossPaymentResult authoritative = tossPaymentPort.getPayment(command.paymentKey());
      paymentFound = reflectAuthoritativeStatus(authoritative);
    }

    if (paymentFound) {
      markProcessed(command.transmissionId());
    }
  }

  private void validateSecret(String providedSecret) {
    byte[] expected =
        (webhookSecret == null || webhookSecret.isBlank())
            ? new byte[0]
            : webhookSecret.getBytes(StandardCharsets.UTF_8);
    byte[] actual =
        providedSecret == null ? new byte[0] : providedSecret.getBytes(StandardCharsets.UTF_8);
    if (expected.length == 0 || !MessageDigest.isEqual(actual, expected)) {
      throw new PaymentWebhookUnauthorizedException();
    }
  }

  private void ensureReceived(HandleTossWebhookCommand command) {
    try {
      transactionTemplate.executeWithoutResult(
          status ->
              webhookEventRepository.save(
                  WebhookEvent.received(
                      command.transmissionId(), command.eventType(), command.maskedPayload())));
    } catch (DataIntegrityViolationException ex) {
      log.debug("Toss 웹훅 동시 수신 감지(멱등): transmissionId={}", command.transmissionId());
    }
  }

  /**
   * Toss 권위 상태를 Payment에 반영한다.
   *
   * @return true: Payment 레코드가 존재하여 반영(또는 반영 불필요)함. false: Payment 미존재 — Toss 재시도를 허용하기 위해
   *     markProcessed()를 건너뜀.
   */
  private boolean reflectAuthoritativeStatus(TossPaymentResult authoritative) {
    Boolean found =
        transactionTemplate.execute(
            status -> {
              Optional<Payment> optPayment =
                  paymentRepository.findByPaymentKey(authoritative.paymentKey());
              optPayment.ifPresent(payment -> applyStatus(payment, authoritative));
              return optPayment.isPresent();
            });
    return Boolean.TRUE.equals(found);
  }

  private void applyStatus(Payment payment, TossPaymentResult authoritative) {
    if (authoritative.isDone() && !payment.isDone()) {
      payment.complete(
          authoritative.paymentKey(),
          authoritative.method(),
          authoritative.approvedAt() != null
              ? authoritative.approvedAt()
              : OffsetDateTime.now(clock),
          authoritative.receiptUrl(),
          authoritative.maskedRawJson());
      paymentRepository.save(payment);
    } else if (authoritative.isCanceled()) {
      payment.markCanceled(authoritative.maskedRawJson());
      paymentRepository.save(payment);
    } else if (authoritative.isPartialCanceled()) {
      payment.markPartialCanceled(authoritative.maskedRawJson());
      paymentRepository.save(payment);
    }
  }

  private void markProcessed(String transmissionId) {
    transactionTemplate.executeWithoutResult(
        status ->
            webhookEventRepository
                .findByTransmissionId(transmissionId)
                .ifPresent(
                    event -> {
                      if (!event.isProcessed()) {
                        event.markProcessed(OffsetDateTime.now(clock));
                        webhookEventRepository.save(event);
                      }
                    }));
  }
}
