package com.init.payment.presentation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.payment.application.HandleTossWebhookCommand;
import com.init.payment.application.PaymentWebhookService;
import com.init.payment.application.TossPayloadMasker;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.infrastructure.web.WebhookHeaderNames;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Toss 웹훅 수신(public). 시크릿 헤더 검증은 application 계층에서 수행한다 (U-003). */
@RestController
@RequestMapping("/api/v1/payments/webhooks")
public class PaymentWebhookController {

  private final PaymentWebhookService paymentWebhookService;
  private final ObjectMapper objectMapper;

  public PaymentWebhookController(
      PaymentWebhookService paymentWebhookService, ObjectMapper objectMapper) {
    this.paymentWebhookService = paymentWebhookService;
    this.objectMapper = objectMapper;
  }

  @PostMapping("/toss")
  public ResponseEntity<Void> receiveTossWebhook(
      @RequestHeader(value = WebhookHeaderNames.TOSS_WEBHOOK_SECRET, required = false)
          String webhookSecret,
      @RequestBody String rawBody) {
    JsonNode root = parse(rawBody);
    JsonNode data = root.path("data");
    String eventType = text(root, "eventType");
    String paymentKey = text(data, "paymentKey");
    String status = text(data, "status");
    String lastTransactionKey = text(data, "lastTransactionKey");
    String eventId = text(root, "eventId");

    paymentWebhookService.handle(
        new HandleTossWebhookCommand(
            webhookSecret,
            HandleTossWebhookCommand.resolveTransmissionId(
                lastTransactionKey, eventId, paymentKey, status, eventType),
            eventType,
            paymentKey,
            TossPayloadMasker.mask(root)));
    return ResponseEntity.ok().build();
  }

  private JsonNode parse(String rawBody) {
    try {
      if (rawBody == null || rawBody.isBlank()) {
        throw new BadRequestException("INVALID_WEBHOOK_PAYLOAD", "웹훅 본문이 비어 있습니다.");
      }
      return objectMapper.readTree(rawBody);
    } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
      throw new BadRequestException("INVALID_WEBHOOK_PAYLOAD", "웹훅 본문이 유효한 JSON이 아닙니다.");
    }
  }

  private static String text(JsonNode node, String field) {
    JsonNode value = node.path(field);
    return value.isMissingNode() || value.isNull() ? null : value.asText();
  }
}
