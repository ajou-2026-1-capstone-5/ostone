package com.init.payment.application;

import com.init.payment.application.exception.PaymentWebhookUnauthorizedException;
import com.init.payment.application.port.TossPaymentPort;
import com.init.payment.application.port.TossPaymentResult;
import com.init.payment.domain.model.Payment;
import com.init.payment.domain.model.WebhookEvent;
import com.init.payment.domain.repository.PaymentRepository;
import com.init.payment.domain.repository.WebhookEventRepository;
import com.init.payment.infrastructure.config.TossApiProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
  private final TossApiProperties properties;
  private final Clock clock;
  private final TransactionTemplate transactionTemplate;

  public PaymentWebhookService(
      WebhookEventRepository webhookEventRepository,
      PaymentRepository paymentRepository,
      TossPaymentPort tossPaymentPort,
      TossApiProperties properties,
      Clock clock,
      PlatformTransactionManager transactionManager) {
    this.webhookEventRepository = webhookEventRepository;
    this.paymentRepository = paymentRepository;
    this.tossPaymentPort = tossPaymentPort;
    this.properties = properties;
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

    if (command.paymentKey() != null && !command.paymentKey().isBlank()) {
      TossPaymentResult authoritative = tossPaymentPort.getPayment(command.paymentKey());
      reflectAuthoritativeStatus(authoritative);
    }

    markProcessed(command.transmissionId());
  }

  private void validateSecret(String providedSecret) {
    String configured = properties.webhook() == null ? null : properties.webhook().secret();
    byte[] expected =
        configured == null ? new byte[0] : configured.getBytes(StandardCharsets.UTF_8);
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

  private void reflectAuthoritativeStatus(TossPaymentResult authoritative) {
    transactionTemplate.executeWithoutResult(
        status ->
            paymentRepository
                .findByPaymentKey(authoritative.paymentKey())
                .ifPresent(payment -> applyStatus(payment, authoritative)));
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
