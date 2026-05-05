package com.init.pipelinejob.infrastructure.airflow;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.application.DomainPackGenerationTriggerCommand;
import com.init.pipelinejob.application.DomainPackGenerationTriggerPort;
import com.init.pipelinejob.application.DomainPackGenerationTriggerResult;
import com.init.pipelinejob.application.exception.AirflowConfigurationInvalidException;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import java.time.Duration;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class AirflowDomainPackGenerationTriggerAdapter implements DomainPackGenerationTriggerPort {

  private final AirflowApiProperties properties;
  private final ObjectMapper objectMapper;

  public AirflowDomainPackGenerationTriggerAdapter(
      AirflowApiProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
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
    RestClient restClient = restClient();
    String token = requestToken(restClient, command.pipelineJobId());

    try {
      restClient
          .post()
          .uri(apiPath("/api/v2/dags/{dagId}/dagRuns"), dagId)
          .headers(headers -> headers.setBearerAuth(token))
          .contentType(MediaType.APPLICATION_JSON)
          .body(buildDagRunRequest(command))
          .retrieve()
          .toBodilessEntity();
      return new DomainPackGenerationTriggerResult(dagId, command.dagRunId());
    } catch (ResourceAccessException ex) {
      if (dagRunExists(restClient, token, dagId, command.dagRunId())) {
        return new DomainPackGenerationTriggerResult(dagId, command.dagRunId());
      }
      throw new AirflowTriggerFailedException(command.pipelineJobId());
    } catch (RestClientResponseException ex) {
      throw new AirflowTriggerFailedException(command.pipelineJobId());
    }
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
        throw new AirflowTriggerFailedException(pipelineJobId);
      }
      return response.accessToken();
    } catch (ResourceAccessException | RestClientResponseException ex) {
      throw new AirflowTriggerFailedException(pipelineJobId);
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
      return false;
    } catch (ResourceAccessException ex) {
      return false;
    }
  }

  private ObjectNode buildDagRunRequest(DomainPackGenerationTriggerCommand command) {
    ObjectNode request = objectMapper.createObjectNode();
    request.put("dag_run_id", command.dagRunId());
    ObjectNode conf = request.putObject("conf");
    conf.put("workspace_id", command.workspaceId());
    conf.put("dataset_id", command.datasetId());
    conf.put("pipeline_job_id", command.pipelineJobId());
    return request;
  }

  private RestClient restClient() {
    AirflowApiProperties.Api api = api();
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(
        durationOrDefault(api.connectTimeout(), Duration.ofSeconds(3)));
    requestFactory.setReadTimeout(durationOrDefault(api.readTimeout(), Duration.ofSeconds(10)));
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
        || isBlank(api.password())) {
      throw new AirflowConfigurationInvalidException();
    }
    return api;
  }

  private String normalizeBaseUrl(String baseUrl) {
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
