package com.init.pipelinejob.infrastructure.airflow;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.application.exception.AirflowConfigurationInvalidException;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.shared.infrastructure.airflow.AirflowApiProperties;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Clock;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

abstract class AirflowHttpSupport {

  static final String LOG_FMT_DAG_RUN_ID = ", dagRunId={}";

  private final Logger log = LoggerFactory.getLogger(getClass());

  protected final AirflowApiProperties properties;
  protected final ObjectMapper objectMapper;
  protected final Clock clock;
  private RestClient restClient;

  AirflowHttpSupport(AirflowApiProperties properties, ObjectMapper objectMapper, Clock clock) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  protected abstract String triggerFailureMessage();

  protected synchronized RestClient restClient() {
    if (restClient == null) {
      restClient = buildRestClient(api());
    }
    return restClient;
  }

  protected String apiPath(String path) {
    return normalizeBaseUrl(api().baseUrl()) + path;
  }

  protected AirflowApiProperties.Api api() {
    AirflowApiProperties.Api api = properties.api();
    if (api == null
        || isBlank(api.baseUrl())
        || isBlank(api.username())
        || isBlank(api.password())
        || !isOriginOnlyBaseUrl(api.baseUrl(), api.allowInsecureHttp())) {
      throw new AirflowConfigurationInvalidException();
    }
    return api;
  }

  protected String requestToken(RestClient client, Long pipelineJobId) {
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
        throw new AirflowTriggerFailedException(pipelineJobId, triggerFailureMessage());
      }
      return response.accessToken();
    } catch (RestClientException | HttpMessageConversionException ex) {
      log.error("Airflow token request failed: pipelineJobId={}", pipelineJobId, ex);
      throw new AirflowTriggerFailedException(pipelineJobId, triggerFailureMessage(), ex);
    }
  }

  protected boolean dagRunExists(RestClient client, String token, String dagId, String dagRunId) {
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

  protected boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private RestClient buildRestClient(AirflowApiProperties.Api api) {
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    Duration connectTimeout = api == null ? null : api.connectTimeout();
    Duration readTimeout = api == null ? null : api.readTimeout();
    requestFactory.setConnectTimeout(durationOrDefault(connectTimeout, Duration.ofSeconds(3)));
    requestFactory.setReadTimeout(durationOrDefault(readTimeout, Duration.ofSeconds(10)));
    return RestClient.builder().requestFactory(requestFactory).build();
  }

  private String normalizeBaseUrl(String baseUrl) {
    URI uri = parseBaseUrl(baseUrl);
    String origin = uri.getScheme() + "://" + uri.getRawAuthority();
    return trimTrailingSlashes(origin);
  }

  private boolean isOriginOnlyBaseUrl(String baseUrl, boolean allowInsecureHttp) {
    URI uri = parseBaseUrl(baseUrl);
    String scheme = uri.getScheme();
    String path = uri.getPath();
    boolean schemeOk =
        "https".equalsIgnoreCase(scheme) || (allowInsecureHttp && "http".equalsIgnoreCase(scheme));
    return schemeOk
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
      throw new AirflowConfigurationInvalidException(ex);
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

  record TokenRequest(String username, String password) {}

  record TokenResponse(@JsonProperty("access_token") String accessToken) {}
}
