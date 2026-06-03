package com.init.payment.infrastructure.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 토스페이먼츠 v2 설정. AirflowApiProperties의 nested sub-record 패턴을 미러링하여 YAML {@code toss.api.*} / {@code
 * toss.webhook.secret} / {@code toss.billing-key-encryption-key}와 바인딩을 정합한다 (SC-B4 해소).
 */
@ConfigurationProperties(prefix = "toss")
@Validated
public record TossApiProperties(
    @NotNull @Valid Api api,
    @NotNull @Valid Webhook webhook,
    @NotBlank String billingKeyEncryptionKey) {

  public record Api(
      @NotBlank String baseUrl,
      @NotBlank String secretKey,
      Duration connectTimeout,
      Duration readTimeout) {}

  public record Webhook(@NotBlank String secret) {}
}
