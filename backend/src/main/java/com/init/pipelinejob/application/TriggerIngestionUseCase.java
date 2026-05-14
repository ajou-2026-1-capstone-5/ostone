package com.init.pipelinejob.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

// NOTE: TransactionTemplate(REQUIRES_NEW)를 사용한다.
// corpus BC의 @Transactional 내부에서 호출되므로, pipeline_job 커밋이 corpus TX와 독립적이어야 함.
// Phase 1/3은 REQUIRES_NEW TX로 corpus TX를 일시 중단하고 별도 커밋.
// Airflow trigger(Phase 2)는 TX 외부에서 실행.
@Service
public class TriggerIngestionUseCase {

  private final PipelineJobRepository pipelineJobRepository;
  private final IngestionAirflowTriggerPort airflowTriggerPort;
  private final ObjectMapper objectMapper;
  private final Clock clock;
  private final TransactionTemplate requiresNewTx;

  public TriggerIngestionUseCase(
      PipelineJobRepository pipelineJobRepository,
      IngestionAirflowTriggerPort airflowTriggerPort,
      ObjectMapper objectMapper,
      Clock clock,
      PlatformTransactionManager transactionManager) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.airflowTriggerPort = airflowTriggerPort;
    this.objectMapper = objectMapper;
    this.clock = clock;
    this.requiresNewTx = buildRequiresNewTemplate(transactionManager);
  }

  public void execute(Long workspaceId, Long datasetId, String objectKey) {
    String dagId = airflowTriggerPort.dagId();
    CreatedJob createdJob =
        requiresNewTx.execute(
            status -> {
              PipelineJob job =
                  PipelineJob.createIngestion(workspaceId, datasetId, OffsetDateTime.now(clock));
              PipelineJob saved = pipelineJobRepository.saveAndFlush(job);
              String dagRunId = "pipeline_job_" + saved.getId();
              saved.assignAirflowRun(
                  dagId,
                  dagRunId,
                  buildPayloadJson(
                      workspaceId, datasetId, objectKey, dagId, dagRunId, saved.getId()));
              pipelineJobRepository.saveAndFlush(saved);
              return new CreatedJob(saved.getId(), dagRunId);
            });

    try {
      airflowTriggerPort.trigger(
          new IngestionTriggerCommand(
              workspaceId,
              datasetId,
              createdJob.pipelineJobId(),
              createdJob.dagRunId(),
              objectKey));
    } catch (AirflowTriggerFailedException ex) {
      markFailed(createdJob.pipelineJobId(), ex.getMessage());
      throw ex;
    }

    requiresNewTx.executeWithoutResult(
        status -> {
          PipelineJob job =
              pipelineJobRepository
                  .findById(createdJob.pipelineJobId())
                  .orElseThrow(
                      () ->
                          new IllegalStateException(
                              "pipeline_job을 찾을 수 없습니다. id=" + createdJob.pipelineJobId()));
          if (PipelineJob.STATUS_QUEUED.equals(job.getStatus())) {
            job.markAirflowTriggered(OffsetDateTime.now(clock));
            pipelineJobRepository.saveAndFlush(job);
          }
        });
  }

  private void markFailed(Long pipelineJobId, String errorMessage) {
    requiresNewTx.executeWithoutResult(
        status -> {
          PipelineJob job =
              pipelineJobRepository
                  .findById(pipelineJobId)
                  .orElseThrow(
                      () ->
                          new IllegalStateException(
                              "pipeline_job을 찾을 수 없습니다. id=" + pipelineJobId));
          if (!job.isFinalized()) {
            job.markFailed(errorMessage, OffsetDateTime.now(clock));
            pipelineJobRepository.saveAndFlush(job);
          }
        });
  }

  private String buildPayloadJson(
      Long workspaceId,
      Long datasetId,
      String objectKey,
      String dagId,
      String dagRunId,
      Long pipelineJobId) {
    ObjectNode payload = objectMapper.createObjectNode();
    payload.put("workspaceId", workspaceId);
    payload.put("datasetId", datasetId);
    payload.put("pipelineJobId", pipelineJobId);
    payload.put("jobType", PipelineJob.JOB_TYPE_INGESTION);
    payload.put("airflowDagId", dagId);
    payload.put("airflowRunId", dagRunId);
    payload.put("objectKey", objectKey);
    try {
      return objectMapper.writeValueAsString(payload);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Ingestion pipeline_job 요청 payload JSON 생성에 실패했습니다.", ex);
    }
  }

  private TransactionTemplate buildRequiresNewTemplate(PlatformTransactionManager tm) {
    TransactionTemplate t = new TransactionTemplate(tm);
    t.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    return t;
  }

  private record CreatedJob(Long pipelineJobId, String dagRunId) {}
}
