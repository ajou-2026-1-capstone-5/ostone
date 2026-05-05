package com.init.pipelinejob.infrastructure.airflow;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "airflow")
public record AirflowApiProperties(Api api, Dags dags) {

  public record Api(
      String baseUrl,
      String username,
      String password,
      Duration connectTimeout,
      Duration readTimeout) {}

  public record Dags(DomainPackGeneration domainPackGeneration) {}

  public record DomainPackGeneration(String dagId) {}
}
