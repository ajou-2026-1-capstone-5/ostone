package com.init.shared.infrastructure.airflow;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "airflow")
public record AirflowApiProperties(Api api, Dags dags) {

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
}
