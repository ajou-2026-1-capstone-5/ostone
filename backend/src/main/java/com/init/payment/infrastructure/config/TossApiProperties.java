package com.init.payment.infrastructure.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 토스페이먼츠 v2 설정. AirflowApiProperties의 nested sub-record 패턴을 미러링하여 YAML {@code toss.api.*} / {@code
 * toss.webhook.secret} / {@code toss.billing-key-encryption-key}와 바인딩을 정합한다 (SC-B4 해소).
 */
@ConfigurationProperties(prefix = "toss")
public record TossApiProperties(Api api, Webhook webhook, String billingKeyEncryptionKey) {

  public record Api(
      String baseUrl, String secretKey, Duration connectTimeout, Duration readTimeout) {}

  public record Webhook(String secret) {}
}
