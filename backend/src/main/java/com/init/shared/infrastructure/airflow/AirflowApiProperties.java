package com.init.shared.infrastructure.airflow;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@ConfigurationProperties(prefix = "airflow")
@Validated
public record AirflowApiProperties(Api api, Dags dags, @NotNull @Valid Webhook webhook) {

  public record Api(
      String baseUrl,
      String username,
      String password,
      Duration connectTimeout,
      Duration readTimeout,
      boolean allowInsecureHttp) {}

  public record Dags(DomainPackGeneration domainPackGeneration, Ingestion ingestion) {}

  public record DomainPackGeneration(String dagId) {}

  public record Ingestion(String dagId) {}

  public record Webhook(@NotBlank String secret) {}
}
