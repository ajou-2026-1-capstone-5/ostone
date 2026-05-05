package com.init.pipelinejob.infrastructure.airflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.application.DomainPackGenerationTriggerCommand;
import com.init.pipelinejob.application.DomainPackGenerationTriggerResult;
import com.init.pipelinejob.application.exception.AirflowConfigurationInvalidException;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("AirflowDomainPackGenerationTriggerAdapter")
class AirflowDomainPackGenerationTriggerAdapterTest {

  private final ObjectMapper objectMapper = new ObjectMapper();
  private HttpServer server;
  private ExecutorService executorService;
  private String baseUrl;

  @BeforeEach
  void setUp() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    executorService = Executors.newCachedThreadPool();
    server.setExecutor(executorService);
    baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    server.start();
  }

  @AfterEach
  void tearDown() {
    server.stop(0);
    executorService.shutdownNow();
  }

  @Test
  @DisplayName("/auth/token으로 JWT를 받은 뒤 Bearer token으로 dagRuns를 생성한다")
  void triggerUsesTokenThenBearerAuth() throws Exception {
    AtomicReference<String> tokenRequestBody = new AtomicReference<>();
    AtomicReference<String> triggerAuthorization = new AtomicReference<>();
    AtomicReference<String> triggerRequestBody = new AtomicReference<>();

    server.createContext(
        "/auth/token",
        exchange -> {
          tokenRequestBody.set(readBody(exchange));
          byte[] response = "{\"access_token\":\"jwt-token-123\"}".getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, response.length);
          exchange.getResponseBody().write(response);
          exchange.close();
        });
    server.createContext(
        "/api/v2/dags/domain_pack_generation/dagRuns",
        exchange -> {
          triggerAuthorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
          triggerRequestBody.set(readBody(exchange));
          exchange.sendResponseHeaders(200, -1);
          exchange.close();
        });

    DomainPackGenerationTriggerResult result =
        adapter().trigger(new DomainPackGenerationTriggerCommand(1L, 7L, 123L, "pipeline_job_123"));

    JsonNode tokenJson = objectMapper.readTree(tokenRequestBody.get());
    JsonNode triggerJson = objectMapper.readTree(triggerRequestBody.get());
    assertThat(tokenJson.get("username").asText()).isEqualTo("admin");
    assertThat(tokenJson.get("password").asText()).isEqualTo("admin-password");
    assertThat(triggerAuthorization.get()).isEqualTo("Bearer jwt-token-123");
    assertThat(triggerJson.get("dag_run_id").asText()).isEqualTo("pipeline_job_123");
    assertThat(triggerJson.get("conf").get("workspace_id").asLong()).isEqualTo(1L);
    assertThat(triggerJson.get("conf").get("dataset_id").asLong()).isEqualTo(7L);
    assertThat(triggerJson.get("conf").get("pipeline_job_id").asLong()).isEqualTo(123L);
    assertThat(result.dagId()).isEqualTo("domain_pack_generation");
    assertThat(result.dagRunId()).isEqualTo("pipeline_job_123");
  }

  @Test
  @DisplayName("base-url 끝에 slash가 있어도 Airflow API 경로를 정상 조립한다")
  void triggerAcceptsBaseUrlWithTrailingSlash() {
    baseUrl = baseUrl + "///";
    AtomicReference<String> triggerAuthorization = new AtomicReference<>();

    server.createContext(
        "/auth/token",
        exchange -> {
          byte[] response = "{\"access_token\":\"jwt-token-123\"}".getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, response.length);
          exchange.getResponseBody().write(response);
          exchange.close();
        });
    server.createContext(
        "/api/v2/dags/domain_pack_generation/dagRuns",
        exchange -> {
          triggerAuthorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
          exchange.sendResponseHeaders(200, -1);
          exchange.close();
        });

    DomainPackGenerationTriggerResult result =
        adapter().trigger(new DomainPackGenerationTriggerCommand(1L, 7L, 123L, "pipeline_job_123"));

    assertThat(triggerAuthorization.get()).isEqualTo("Bearer jwt-token-123");
    assertThat(result.dagRunId()).isEqualTo("pipeline_job_123");
  }

  @Test
  @DisplayName("base-url에 api/v2가 포함되어 있으면 설정 오류로 처리한다")
  void dagIdWithApiV2BaseUrlThrowsConfigurationInvalid() {
    baseUrl = baseUrl + "/api/v2/";

    assertThatThrownBy(() -> adapter().dagId())
        .isInstanceOf(AirflowConfigurationInvalidException.class);
  }

  @Test
  @DisplayName("token 응답에 access_token이 없으면 trigger 실패로 처리한다")
  void triggerWithoutAccessTokenThrows() {
    server.createContext(
        "/auth/token",
        exchange -> {
          byte[] response = "{\"token\":\"jwt-token-123\"}".getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, response.length);
          exchange.getResponseBody().write(response);
          exchange.close();
        });

    assertThatThrownBy(
            () ->
                adapter()
                    .trigger(
                        new DomainPackGenerationTriggerCommand(1L, 7L, 123L, "pipeline_job_123")))
        .isInstanceOf(AirflowTriggerFailedException.class);
  }

  @Test
  @DisplayName("token 응답 JSON을 파싱할 수 없으면 trigger 실패로 처리한다")
  void triggerWithMalformedTokenResponseThrows() {
    server.createContext(
        "/auth/token",
        exchange -> {
          byte[] response = "{".getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, response.length);
          exchange.getResponseBody().write(response);
          exchange.close();
        });

    assertThatThrownBy(
            () ->
                adapter()
                    .trigger(
                        new DomainPackGenerationTriggerCommand(1L, 7L, 123L, "pipeline_job_123")))
        .isInstanceOf(AirflowTriggerFailedException.class);
  }

  @Test
  @DisplayName("dagRuns 생성 응답이 끊겨도 reconciliation GET에서 확인되면 성공 처리한다")
  void triggerTimeoutButDagRunExistsReturnsSuccess() {
    server.createContext(
        "/auth/token",
        exchange -> {
          byte[] response = "{\"access_token\":\"jwt-token-123\"}".getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, response.length);
          exchange.getResponseBody().write(response);
          exchange.close();
        });
    server.createContext(
        "/api/v2/dags/domain_pack_generation/dagRuns",
        exchange -> {
          sleepLongerThanReadTimeout();
          exchange.sendResponseHeaders(200, -1);
          exchange.close();
        });
    server.createContext(
        "/api/v2/dags/domain_pack_generation/dagRuns/pipeline_job_123",
        exchange -> {
          assertThat(exchange.getRequestHeaders().getFirst("Authorization"))
              .isEqualTo("Bearer jwt-token-123");
          exchange.sendResponseHeaders(200, -1);
          exchange.close();
        });

    DomainPackGenerationTriggerResult result =
        adapter(Duration.ofMillis(50), Duration.ofMillis(50))
            .trigger(new DomainPackGenerationTriggerCommand(1L, 7L, 123L, "pipeline_job_123"));

    assertThat(result.dagRunId()).isEqualTo("pipeline_job_123");
  }

  private AirflowDomainPackGenerationTriggerAdapter adapter() {
    return adapter(Duration.ofSeconds(1), Duration.ofSeconds(1));
  }

  private AirflowDomainPackGenerationTriggerAdapter adapter(
      Duration connectTimeout, Duration readTimeout) {
    AirflowApiProperties properties =
        new AirflowApiProperties(
            new AirflowApiProperties.Api(
                baseUrl, "admin", "admin-password", connectTimeout, readTimeout),
            new AirflowApiProperties.Dags(
                new AirflowApiProperties.DomainPackGeneration("domain_pack_generation")));
    return new AirflowDomainPackGenerationTriggerAdapter(properties, objectMapper);
  }

  private String readBody(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
    return new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
  }

  private void sleepLongerThanReadTimeout() {
    try {
      Thread.sleep(200);
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
    }
  }
}
