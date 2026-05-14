package com.init.pipelinejob.infrastructure.airflow;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.application.IngestionAirflowTriggerPort;
import com.init.pipelinejob.application.IngestionTriggerCommand;
import com.init.pipelinejob.application.exception.AirflowConfigurationInvalidException;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.shared.infrastructure.airflow.AirflowApiProperties;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class AirflowIngestionTriggerAdapter implements IngestionAirflowTriggerPort {

  private static final Logger log = LoggerFactory.getLogger(AirflowIngestionTriggerAdapter.class);
  private static final String LOG_FMT_DAG_RUN_ID = ", dagRunId={}";

  private final AirflowApiProperties properties;
  private final ObjectMapper objectMapper;
  private final Clock clock;
  private RestClient restClient;

  public AirflowIngestionTriggerAdapter(
      AirflowApiProperties properties, ObjectMapper objectMapper, Clock clock) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  @Override
  public String dagId() {
    api();
    if (properties.dags() == null || properties.dags().ingestion() == null) {
      throw new AirflowConfigurationInvalidException();
    }
    String dagId = properties.dags().ingestion().dagId();
    if (isBlank(dagId)) {
      throw new AirflowConfigurationInvalidException();
    }
    return dagId;
  }

  @Override
  public void trigger(IngestionTriggerCommand command) {
    String dagId = dagId();
    String dagRunId = command.dagRunId();
    Long pipelineJobId = command.pipelineJobId();
    RestClient client = restClient();
    String token = requestToken(client, pipelineJobId);

    try {
      client
          .post()
          .uri(apiPath("/api/v2/dags/{dagId}/dagRuns"), dagId)
          .headers(headers -> headers.setBearerAuth(token))
          .contentType(MediaType.APPLICATION_JSON)
          .body(buildDagRunRequest(command))
          .retrieve()
          .toBodilessEntity();
    } catch (ResourceAccessException ex) {
      log.warn(
          "Airflow Ingestion DAG run creation access failed, reconciling: pipelineJobId={}, dagId={}"
              + LOG_FMT_DAG_RUN_ID,
          pipelineJobId,
          dagId,
          dagRunId,
          ex);
      reconcileDagRunOrThrow(client, token, dagId, dagRunId, pipelineJobId, ex);
    } catch (RestClientResponseException ex) {
      if (ex.getStatusCode().isSameCodeAs(HttpStatus.CONFLICT)) {
        log.warn(
            "Airflow Ingestion DAG run already exists, reconciling: pipelineJobId={}, dagId={}"
                + LOG_FMT_DAG_RUN_ID,
            pipelineJobId,
            dagId,
            dagRunId,
            ex);
        reconcileDagRunOrThrow(client, token, dagId, dagRunId, pipelineJobId, ex);
        return;
      }
      log.error(
          "Airflow Ingestion DAG run creation failed: pipelineJobId={}, dagId={}, dagRunId={},"
              + " status={}",
          pipelineJobId,
          dagId,
          dagRunId,
          ex.getStatusCode(),
          ex);
      throw new AirflowTriggerFailedException(pipelineJobId, "Ingestion DAG 실행 요청에 실패했습니다.", ex);
    } catch (RestClientException ex) {
      log.warn(
          "Airflow Ingestion DAG run creation client failed, reconciling: pipelineJobId={},"
              + " dagId={}"
              + LOG_FMT_DAG_RUN_ID,
          pipelineJobId,
          dagId,
          dagRunId,
          ex);
      reconcileDagRunOrThrow(client, token, dagId, dagRunId, pipelineJobId, ex);
    } catch (HttpMessageConversionException ex) {
      log.error(
          "Airflow Ingestion DAG run creation response conversion failed: pipelineJobId={}, dagId={}"
              + LOG_FMT_DAG_RUN_ID,
          pipelineJobId,
          dagId,
          dagRunId,
          ex);
      throw new AirflowTriggerFailedException(pipelineJobId, "Ingestion DAG 실행 요청에 실패했습니다.", ex);
    }
  }

  private void reconcileDagRunOrThrow(
      RestClient client,
      String token,
      String dagId,
      String dagRunId,
      Long pipelineJobId,
      RuntimeException triggerCause) {
    try {
      if (dagRunExists(client, token, dagId, dagRunId)) {
        return;
      }
    } catch (RestClientException | HttpMessageConversionException ex) {
      throw new AirflowTriggerFailedException(pipelineJobId, "Ingestion DAG 실행 요청에 실패했습니다.", ex);
    }
    throw new AirflowTriggerFailedException(
        pipelineJobId, "Ingestion DAG 실행 요청에 실패했습니다.", triggerCause);
  }

  private String requestToken(RestClient client, Long pipelineJobId) {
    try {
      TokenResponse response =
          client
              .post()
              .uri(apiPath("/auth/token"))
              .contentType(MediaType.APPLICATION_JSON)
              .body(new TokenRequest(api().username(), api().password()))
              .retrieve()
              .body(TokenResponse.class);
      if (response == null || isBlank(response.accessToken())) {
        log.error(
            "Airflow token response did not include access_token: pipelineJobId={}", pipelineJobId);
        throw new AirflowTriggerFailedException(pipelineJobId, "Ingestion DAG 실행 요청에 실패했습니다.");
      }
      return response.accessToken();
    } catch (RestClientException | HttpMessageConversionException ex) {
      log.error("Airflow token request failed: pipelineJobId={}", pipelineJobId, ex);
      throw new AirflowTriggerFailedException(pipelineJobId, "Ingestion DAG 실행 요청에 실패했습니다.", ex);
    }
  }

  private boolean dagRunExists(RestClient client, String token, String dagId, String dagRunId) {
    try {
      client
          .get()
          .uri(apiPath("/api/v2/dags/{dagId}/dagRuns/{dagRunId}"), dagId, dagRunId)
          .headers(headers -> headers.setBearerAuth(token))
          .retrieve()
          .toBodilessEntity();
      return true;
    } catch (RestClientResponseException ex) {
      if (ex.getStatusCode().isSameCodeAs(HttpStatus.NOT_FOUND)) {
        return false;
      }
      throw ex;
    }
  }

  private ObjectNode buildDagRunRequest(IngestionTriggerCommand command) {
    ObjectNode request = objectMapper.createObjectNode();
    request.put("dag_run_id", command.dagRunId());
    request.put(
        "logical_date", OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC).toString());
    ObjectNode conf = request.putObject("conf");
    conf.put("workspace_id", command.workspaceId());
    conf.put("dataset_id", command.datasetId());
    conf.put("pipeline_job_id", command.pipelineJobId());
    conf.put("object_key", command.objectKey());
    return request;
  }

  private synchronized RestClient restClient() {
    if (restClient == null) {
      restClient = buildRestClient(api());
    }
    return restClient;
  }

  private RestClient buildRestClient(AirflowApiProperties.Api api) {
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    Duration connectTimeout = api == null ? null : api.connectTimeout();
    Duration readTimeout = api == null ? null : api.readTimeout();
    requestFactory.setConnectTimeout(durationOrDefault(connectTimeout, Duration.ofSeconds(3)));
    requestFactory.setReadTimeout(durationOrDefault(readTimeout, Duration.ofSeconds(10)));
    return RestClient.builder().requestFactory(requestFactory).build();
  }

  private String apiPath(String path) {
    return normalizeBaseUrl(api().baseUrl()) + path;
  }

  private AirflowApiProperties.Api api() {
    AirflowApiProperties.Api api = properties.api();
    if (api == null
        || isBlank(api.baseUrl())
        || isBlank(api.username())
        || isBlank(api.password())
        || !isOriginOnlyBaseUrl(api.baseUrl())) {
      throw new AirflowConfigurationInvalidException();
    }
    return api;
  }

  private String normalizeBaseUrl(String baseUrl) {
    URI uri = parseBaseUrl(baseUrl);
    String origin = uri.getScheme() + "://" + uri.getRawAuthority();
    return trimTrailingSlashes(origin);
  }

  private boolean isOriginOnlyBaseUrl(String baseUrl) {
    URI uri = parseBaseUrl(baseUrl);
    String scheme = uri.getScheme();
    String path = uri.getPath();
    return ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
        && !isBlank(uri.getHost())
        && uri.getUserInfo() == null
        && (path == null || path.isBlank() || "/".equals(path))
        && uri.getQuery() == null
        && uri.getFragment() == null;
  }

  private URI parseBaseUrl(String baseUrl) {
    try {
      return new URI(trimTrailingSlashes(baseUrl));
    } catch (URISyntaxException ex) {
      throw new AirflowConfigurationInvalidException();
    }
  }

  private String trimTrailingSlashes(String baseUrl) {
    String normalized = baseUrl.trim();
    while (normalized.endsWith("/")) {
      normalized = normalized.substring(0, normalized.length() - 1);
    }
    return normalized;
  }

  private Duration durationOrDefault(Duration duration, Duration defaultValue) {
    return duration == null ? defaultValue : duration;
  }

  private boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private record TokenRequest(String username, String password) {}

  private record TokenResponse(@JsonProperty("access_token") String accessToken) {}
}
