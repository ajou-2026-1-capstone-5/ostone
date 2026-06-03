package com.init.payment.infrastructure.toss;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.payment.application.TossPayloadMasker;
import com.init.payment.application.exception.PaymentGatewayException;
import com.init.payment.application.exception.PaymentRejectedException;
import com.init.payment.application.port.TossBillingExecuteCommand;
import com.init.payment.application.port.TossBillingKeyResult;
import com.init.payment.application.port.TossPaymentPort;
import com.init.payment.application.port.TossPaymentResult;
import com.init.payment.infrastructure.config.TossApiProperties;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class TossPaymentClient implements TossPaymentPort {

  private static final Logger log = LoggerFactory.getLogger(TossPaymentClient.class);
  private static final String IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

  private final TossApiProperties properties;
  private final ObjectMapper objectMapper;
  private RestClient restClient;

  public TossPaymentClient(TossApiProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
  }

  @Override
  public TossBillingKeyResult issueBillingKey(String authKey, String customerKey) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("authKey", authKey);
    body.put("customerKey", customerKey);
    JsonNode root = post("/v1/billing/authorizations/issue", body, "billingKey 발급");

    JsonNode card = root.path("card");
    return new TossBillingKeyResult(
        text(root, "billingKey"),
        text(root, "customerKey"),
        firstNonBlank(text(card, "company"), text(card, "issuerCode")),
        text(card, "number"),
        maskedJson(root));
  }

  @Override
  public TossPaymentResult confirmPayment(String paymentKey, String orderId, long amount) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("paymentKey", paymentKey);
    body.put("orderId", orderId);
    body.put("amount", amount);
    JsonNode root = post("/v1/payments/confirm", body, "결제 승인");
    return toPaymentResult(root);
  }

  @Override
  public TossPaymentResult executeBilling(TossBillingExecuteCommand command) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("customerKey", command.customerKey());
    body.put("amount", command.amount());
    body.put("orderId", command.orderId());
    body.put("orderName", command.orderName());
    JsonNode root = post("/v1/billing/" + command.billingKey(), body, "정기결제 실행");
    return toPaymentResult(root);
  }

  @Override
  public TossPaymentResult cancelPayment(
      String paymentKey, String cancelReason, Long cancelAmount) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("cancelReason", cancelReason);
    if (cancelAmount != null) {
      body.put("cancelAmount", cancelAmount);
    }
    JsonNode root = post("/v1/payments/" + paymentKey + "/cancel", body, "결제 취소");
    return toPaymentResult(root);
  }

  @Override
  public TossPaymentResult getPayment(String paymentKey) {
    try {
      String raw =
          restClient()
              .get()
              .uri(apiPath("/v1/payments/" + paymentKey))
              .headers(headers -> headers.setBasicAuth(secretKey(), ""))
              .retrieve()
              .body(String.class);
      return toPaymentResult(readTree(raw));
    } catch (RestClientException | HttpMessageConversionException ex) {
      throw gatewayError("결제 재조회", ex);
    }
  }

  private JsonNode post(String path, Map<String, Object> body, String action) {
    try {
      String raw =
          restClient()
              .post()
              .uri(apiPath(path))
              .contentType(MediaType.APPLICATION_JSON)
              .headers(
                  headers -> {
                    headers.setBasicAuth(secretKey(), "");
                    headers.set(IDEMPOTENCY_KEY_HEADER, UUID.randomUUID().toString());
                  })
              .body(body)
              .retrieve()
              .body(String.class);
      return readTree(raw);
    } catch (RestClientResponseException ex) {
      if (ex.getStatusCode().is4xxClientError()) {
        log.warn("Toss API가 요청을 거절했습니다: action={}, status={}", action, ex.getStatusCode());
        throw new PaymentRejectedException("토스페이먼츠가 " + action + " 요청을 거절했습니다.", ex);
      }
      throw gatewayError(action, ex);
    } catch (RestClientException | HttpMessageConversionException ex) {
      throw gatewayError(action, ex);
    }
  }

  private TossPaymentResult toPaymentResult(JsonNode root) {
    JsonNode cancels = root.path("cancels");
    String transactionKey = null;
    if (cancels.isArray() && !cancels.isEmpty()) {
      transactionKey = text(cancels.get(cancels.size() - 1), "transactionKey");
    }
    return new TossPaymentResult(
        text(root, "paymentKey"),
        text(root, "orderId"),
        root.path("totalAmount").asLong(0L),
        text(root, "status"),
        text(root, "method"),
        parseDateTime(text(root, "approvedAt")),
        text(root.path("receipt"), "url"),
        transactionKey,
        maskedJson(root));
  }

  private JsonNode readTree(String raw) {
    try {
      if (raw == null || raw.isBlank()) {
        return objectMapper.createObjectNode();
      }
      return objectMapper.readTree(raw);
    } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
      throw new PaymentGatewayException("Toss 응답 파싱에 실패했습니다.", ex);
    }
  }

  /** 민감 필드(billingKey/secretKey/authKey 등)를 제거한 마스킹 JSON 문자열을 반환한다 (U-012). */
  private String maskedJson(JsonNode root) {
    return TossPayloadMasker.mask(root);
  }

  private PaymentGatewayException gatewayError(String action, Exception ex) {
    log.error("Toss API 호출 실패: action={}", action, ex);
    return new PaymentGatewayException("토스페이먼츠 " + action + " 호출에 실패했습니다.", ex);
  }

  private String apiPath(String path) {
    String baseUrl = properties.api() == null ? null : properties.api().baseUrl();
    if (baseUrl == null || baseUrl.isBlank()) {
      throw new PaymentGatewayException("toss.api.base-url이 설정되지 않았습니다.");
    }
    return trimTrailingSlashes(baseUrl) + path;
  }

  private String secretKey() {
    String secretKey = properties.api() == null ? null : properties.api().secretKey();
    if (secretKey == null || secretKey.isBlank()) {
      throw new PaymentGatewayException("TOSS_SECRET_KEY가 설정되지 않았습니다.");
    }
    return secretKey;
  }

  private synchronized RestClient restClient() {
    if (restClient == null) {
      SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
      TossApiProperties.Api api = properties.api();
      requestFactory.setConnectTimeout(
          durationOrDefault(api == null ? null : api.connectTimeout(), Duration.ofSeconds(3)));
      requestFactory.setReadTimeout(
          durationOrDefault(api == null ? null : api.readTimeout(), Duration.ofSeconds(10)));
      restClient = RestClient.builder().requestFactory(requestFactory).build();
    }
    return restClient;
  }

  private Duration durationOrDefault(Duration duration, Duration defaultValue) {
    return duration == null ? defaultValue : duration;
  }

  private String trimTrailingSlashes(String value) {
    String normalized = value.trim();
    while (normalized.endsWith("/")) {
      normalized = normalized.substring(0, normalized.length() - 1);
    }
    return normalized;
  }

  private static String text(JsonNode node, String field) {
    JsonNode value = node.path(field);
    return value.isMissingNode() || value.isNull() ? null : value.asText();
  }

  private static String firstNonBlank(String a, String b) {
    if (a != null && !a.isBlank()) {
      return a;
    }
    return b;
  }

  private static OffsetDateTime parseDateTime(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return OffsetDateTime.parse(value);
    } catch (java.time.format.DateTimeParseException ex) {
      return null;
    }
  }
}
