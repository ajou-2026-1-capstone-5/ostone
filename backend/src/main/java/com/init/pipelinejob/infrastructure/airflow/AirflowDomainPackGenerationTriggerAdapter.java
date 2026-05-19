package com.init.pipelinejob.infrastructure.airflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.application.DomainPackGenerationTriggerCommand;
import com.init.pipelinejob.application.DomainPackGenerationTriggerPort;
import com.init.pipelinejob.application.DomainPackGenerationTriggerResult;
import com.init.pipelinejob.application.exception.AirflowConfigurationInvalidException;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.shared.infrastructure.airflow.AirflowApiProperties;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class AirflowDomainPackGenerationTriggerAdapter extends AirflowHttpSupport
    implements DomainPackGenerationTriggerPort {

  private static final Logger log =
      LoggerFactory.getLogger(AirflowDomainPackGenerationTriggerAdapter.class);

  public AirflowDomainPackGenerationTriggerAdapter(
      AirflowApiProperties properties, ObjectMapper objectMapper, Clock clock) {
    super(properties, objectMapper, clock);
  }

  @Override
  protected String triggerFailureMessage() {
    return "Domain Pack Generation DAG 실행 요청에 실패했습니다.";
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
      return triggerResult(dagId, dagRunId);
    } catch (ResourceAccessException ex) {
      log.warn(
          "Airflow DAG run creation access failed, reconciling: pipelineJobId={}, dagId={}"
              + LOG_FMT_DAG_RUN_ID,
          pipelineJobId,
          dagId,
          dagRunId,
          ex);
      return reconcileDagRunOrThrow(client, token, dagId, dagRunId, pipelineJobId, ex);
    } catch (RestClientResponseException ex) {
      if (ex.getStatusCode().isSameCodeAs(HttpStatus.CONFLICT)) {
        log.warn(
            "Airflow DAG run already exists, reconciling: pipelineJobId={}, dagId={}"
                + LOG_FMT_DAG_RUN_ID,
            pipelineJobId,
            dagId,
            dagRunId,
            ex);
        return reconcileDagRunOrThrow(client, token, dagId, dagRunId, pipelineJobId, ex);
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
          "Airflow DAG run creation client failed, reconciling: pipelineJobId={}, dagId={}"
              + LOG_FMT_DAG_RUN_ID,
          pipelineJobId,
          dagId,
          dagRunId,
          ex);
      return reconcileDagRunOrThrow(client, token, dagId, dagRunId, pipelineJobId, ex);
    } catch (HttpMessageConversionException ex) {
      log.error(
          "Airflow DAG run creation response conversion failed: pipelineJobId={}, dagId={}"
              + LOG_FMT_DAG_RUN_ID,
          pipelineJobId,
          dagId,
          dagRunId,
          ex);
      throw new AirflowTriggerFailedException(pipelineJobId, ex);
    }
  }

  private DomainPackGenerationTriggerResult reconcileDagRunOrThrow(
      RestClient client,
      String token,
      String dagId,
      String dagRunId,
      Long pipelineJobId,
      RuntimeException triggerCause) {
    try {
      if (dagRunExists(client, token, dagId, dagRunId)) {
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

  private ObjectNode buildDagRunRequest(DomainPackGenerationTriggerCommand command) {
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
}
