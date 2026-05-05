package com.init.pipelinejob.infrastructure.airflow;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.application.DomainPackGenerationTriggerCommand;
import com.init.pipelinejob.application.DomainPackGenerationTriggerPort;
import com.init.pipelinejob.application.DomainPackGenerationTriggerResult;
import com.init.pipelinejob.application.exception.AirflowConfigurationInvalidException;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
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
public class AirflowDomainPackGenerationTriggerAdapter implements DomainPackGenerationTriggerPort {

  private static final Logger log =
      LoggerFactory.getLogger(AirflowDomainPackGenerationTriggerAdapter.class);

  private final AirflowApiProperties properties;
  private final ObjectMapper objectMapper;
  private final Clock clock;
  private RestClient restClient;

  public AirflowDomainPackGenerationTriggerAdapter(
      AirflowApiProperties properties, ObjectMapper objectMapper, Clock clock) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  @Override
  public String dagId() {
    api();
    if (properties.dags() == null || properties.dags().domainPackGeneration() == null) {
      throw new AirflowConfigurationInvalidException();
    }
    String dagId = properties.dags().domainPackGeneration().dagId();
    if (isBlank(dagId)) {
      throw new AirflowConfigurationInvalidException();
    }
    return dagId;
  }

  @Override
  public DomainPackGenerationTriggerResult trigger(DomainPackGenerationTriggerCommand command) {
    String dagId = dagId();
    String dagRunId = command.dagRunId();
    Long pipelineJobId = command.pipelineJobId();
    RestClient restClient = restClient();
    String token = requestToken(restClient, pipelineJobId);

    try {
      restClient
          .post()
          .uri(apiPath("/api/v2/dags/{dagId}/dagRuns"), dagId)
          .headers(headers -> headers.setBearerAuth(token))
          .contentType(MediaType.APPLICATION_JSON)
          .body(buildDagRunRequest(command))
          .retrieve()
          .toBodilessEntity();
      return triggerResult(dagId, dagRunId);
    } catch (ResourceAccessException ex) {
      log.warn(
          "Airflow DAG run creation access failed, reconciling: pipelineJobId={}, dagId={},"
              + " dagRunId={}",
          pipelineJobId,
          dagId,
          dagRunId,
          ex);
      return reconcileDagRunOrThrow(restClient, token, dagId, dagRunId, pipelineJobId, ex);
    } catch (RestClientResponseException ex) {
      if (ex.getStatusCode().isSameCodeAs(HttpStatus.CONFLICT)) {
        log.warn(
            "Airflow DAG run already exists, reconciling: pipelineJobId={}, dagId={}, dagRunId={}",
            pipelineJobId,
            dagId,
            dagRunId,
            ex);
        return reconcileDagRunOrThrow(restClient, token, dagId, dagRunId, pipelineJobId, ex);
      }
      log.error(
          "Airflow DAG run creation failed: pipelineJobId={}, dagId={}, dagRunId={}, status={}",
          pipelineJobId,
          dagId,
          dagRunId,
          ex.getStatusCode(),
          ex);
      throw new AirflowTriggerFailedException(pipelineJobId, ex);
    } catch (RestClientException ex) {
      log.warn(
          "Airflow DAG run creation client failed, reconciling: pipelineJobId={}, dagId={},"
              + " dagRunId={}",
          pipelineJobId,
          dagId,
          dagRunId,
          ex);
      return reconcileDagRunOrThrow(restClient, token, dagId, dagRunId, pipelineJobId, ex);
    } catch (HttpMessageConversionException ex) {
      log.error(
          "Airflow DAG run creation response conversion failed: pipelineJobId={}, dagId={},"
              + " dagRunId={}",
          pipelineJobId,
          dagId,
          dagRunId,
          ex);
      throw new AirflowTriggerFailedException(pipelineJobId, ex);
    }
  }

  private DomainPackGenerationTriggerResult reconcileDagRunOrThrow(
      RestClient restClient,
      String token,
      String dagId,
      String dagRunId,
      Long pipelineJobId,
      RuntimeException triggerCause) {
    try {
      if (dagRunExists(restClient, token, dagId, dagRunId)) {
        return triggerResult(dagId, dagRunId);
      }
    } catch (RestClientException | HttpMessageConversionException ex) {
      throw new AirflowTriggerFailedException(pipelineJobId, ex);
    }
    throw new AirflowTriggerFailedException(pipelineJobId, triggerCause);
  }

  private DomainPackGenerationTriggerResult triggerResult(String dagId, String dagRunId) {
    return new DomainPackGenerationTriggerResult(dagId, dagRunId);
  }

  private String requestToken(RestClient restClient, Long pipelineJobId) {
    try {
      TokenResponse response =
          restClient
              .post()
              .uri(apiPath("/auth/token"))
              .contentType(MediaType.APPLICATION_JSON)
              .body(new TokenRequest(api().username(), api().password()))
              .retrieve()
              .body(TokenResponse.class);
      if (response == null || isBlank(response.accessToken())) {
        log.error(
            "Airflow token response did not include access_token: pipelineJobId={}", pipelineJobId);
        throw new AirflowTriggerFailedException(pipelineJobId);
      }
      return response.accessToken();
    } catch (RestClientException | HttpMessageConversionException ex) {
      log.error("Airflow token request failed: pipelineJobId={}", pipelineJobId, ex);
      throw new AirflowTriggerFailedException(pipelineJobId, ex);
    }
  }

  private boolean dagRunExists(RestClient restClient, String token, String dagId, String dagRunId) {
    try {
      restClient
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
      log.error(
          "Airflow DAG run reconciliation failed: dagId={}, dagRunId={}, status={}",
          dagId,
          dagRunId,
          ex.getStatusCode(),
          ex);
      throw ex;
    } catch (RestClientException | HttpMessageConversionException ex) {
      log.error(
          "Airflow DAG run reconciliation failed: dagId={}, dagRunId={}", dagId, dagRunId, ex);
      throw ex;
    }
  }

  private ObjectNode buildDagRunRequest(DomainPackGenerationTriggerCommand command) {
    ObjectNode request = objectMapper.createObjectNode();
    request.put("dag_run_id", command.dagRunId());
    request.put(
        "logical_date", OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC).toString());
    ObjectNode conf = request.putObject("conf");
    conf.put("workspace_id", command.workspaceId());
    conf.put("dataset_id", command.datasetId());
    conf.put("pipeline_job_id", command.pipelineJobId());
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
