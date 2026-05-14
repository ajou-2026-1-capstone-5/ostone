package com.init.pipelinejob.infrastructure.airflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.application.IngestionTriggerCommand;
import com.init.pipelinejob.application.exception.AirflowConfigurationInvalidException;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.shared.infrastructure.airflow.AirflowApiProperties;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClientResponseException;

@DisplayName("AirflowIngestionTriggerAdapter")
class AirflowIngestionTriggerAdapterTest {

  private final ObjectMapper objectMapper = new ObjectMapper();
  private final Clock fixedClock =
      Clock.fixed(Instant.parse("2026-05-14T10:00:00Z"), ZoneOffset.UTC);
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
  @DisplayName("trigger_성공_JWT_토큰_후_Bearer_인증으로_dagRuns_생성")
  void trigger_success_tokenThenBearerAuth() throws Exception {
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

    adapter().trigger(command());

    JsonNode tokenJson = objectMapper.readTree(tokenRequestBody.get());
    JsonNode triggerJson = objectMapper.readTree(triggerRequestBody.get());
    assertThat(tokenJson.get("username").asText()).isEqualTo("admin");
    assertThat(tokenJson.get("password").asText()).isEqualTo("admin-password");
    assertThat(triggerAuthorization.get()).isEqualTo("Bearer jwt-token-123");
    assertThat(triggerJson.get("dag_run_id").asText()).isEqualTo("pipeline_job_99");
    assertThat(triggerJson.get("logical_date").asText()).isEqualTo("2026-05-14T10:00Z");
    JsonNode conf = triggerJson.get("conf");
    assertThat(conf.get("workspace_id").asLong()).isEqualTo(1L);
    assertThat(conf.get("dataset_id").asLong()).isEqualTo(42L);
    assertThat(conf.get("pipeline_job_id").asLong()).isEqualTo(99L);
    assertThat(conf.get("object_key").asText()).isEqualTo("workspaces/1/key.json");
  }

  @Test
  @DisplayName("trigger_409_충돌_후_GET에서_존재_확인되면_성공")
  void trigger_409_conflict_reconciles() {
    stubTokenSuccess();
    stubDagRunCreation(409);
    server.createContext(
        "/api/v2/dags/domain_pack_generation/dagRuns/pipeline_job_99",
        exchange -> {
          exchange.sendResponseHeaders(200, -1);
          exchange.close();
        });

    adapter().trigger(command());
  }

  @Test
  @DisplayName("trigger_409_reconciliation_GET_404면_예외_전파")
  void trigger_409_reconciliation_GET_notFound_throws() {
    stubTokenSuccess();
    stubDagRunCreation(409);
    server.createContext(
        "/api/v2/dags/domain_pack_generation/dagRuns/pipeline_job_99",
        exchange -> {
          exchange.sendResponseHeaders(404, -1);
          exchange.close();
        });

    assertThatThrownBy(() -> adapter().trigger(command()))
        .isInstanceOf(AirflowTriggerFailedException.class)
        .hasCauseInstanceOf(RestClientResponseException.class);
  }

  @Test
  @DisplayName("trigger_500_서버_오류면_예외_전파")
  void trigger_500_serverError_throws() {
    stubTokenSuccess();
    stubDagRunCreation(500);

    assertThatThrownBy(() -> adapter().trigger(command()))
        .isInstanceOf(AirflowTriggerFailedException.class)
        .hasCauseInstanceOf(RestClientResponseException.class);
  }

  @Test
  @DisplayName("dagId_설정_누락이면_AirflowConfigurationInvalidException_던짐")
  void dagId_blank_throws_AirflowConfigurationInvalidException() {
    AirflowApiProperties properties =
        new AirflowApiProperties(
            new AirflowApiProperties.Api(
                baseUrl, "admin", "admin-password", Duration.ofSeconds(1), Duration.ofSeconds(1)),
            new AirflowApiProperties.Dags(null, new AirflowApiProperties.Ingestion("")));
    AirflowIngestionTriggerAdapter adapter =
        new AirflowIngestionTriggerAdapter(properties, objectMapper, fixedClock);

    assertThatThrownBy(adapter::dagId).isInstanceOf(AirflowConfigurationInvalidException.class);
  }

  @Test
  @DisplayName("ingestion_dags_설정_null이면_AirflowConfigurationInvalidException_던짐")
  void dagId_ingestionDagsNull_throws() {
    AirflowApiProperties properties =
        new AirflowApiProperties(
            new AirflowApiProperties.Api(
                baseUrl, "admin", "admin-password", Duration.ofSeconds(1), Duration.ofSeconds(1)),
            new AirflowApiProperties.Dags(null, null));
    AirflowIngestionTriggerAdapter adapter =
        new AirflowIngestionTriggerAdapter(properties, objectMapper, fixedClock);

    assertThatThrownBy(adapter::dagId).isInstanceOf(AirflowConfigurationInvalidException.class);
  }

  @Test
  @DisplayName("trigger_실패_메시지에_Ingestion_문자열_포함")
  void trigger_failureMessage_containsIngestion() {
    stubTokenSuccess();
    stubDagRunCreation(500);

    assertThatThrownBy(() -> adapter().trigger(command()))
        .isInstanceOf(AirflowTriggerFailedException.class)
        .hasMessageContaining("Ingestion");
  }

  private void stubTokenSuccess() {
    server.createContext(
        "/auth/token",
        exchange -> {
          byte[] response = "{\"access_token\":\"jwt-token-123\"}".getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, response.length);
          exchange.getResponseBody().write(response);
          exchange.close();
        });
  }

  private void stubDagRunCreation(int statusCode) {
    server.createContext(
        "/api/v2/dags/domain_pack_generation/dagRuns",
        exchange -> {
          exchange.sendResponseHeaders(statusCode, -1);
          exchange.close();
        });
  }

  private AirflowIngestionTriggerAdapter adapter() {
    AirflowApiProperties properties =
        new AirflowApiProperties(
            new AirflowApiProperties.Api(
                baseUrl, "admin", "admin-password", Duration.ofSeconds(1), Duration.ofSeconds(1)),
            new AirflowApiProperties.Dags(
                null, new AirflowApiProperties.Ingestion("domain_pack_generation")));
    return new AirflowIngestionTriggerAdapter(properties, objectMapper, fixedClock);
  }

  private IngestionTriggerCommand command() {
    return new IngestionTriggerCommand(1L, 42L, 99L, "pipeline_job_99", "workspaces/1/key.json");
  }

  private String readBody(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
    return new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
  }
}
