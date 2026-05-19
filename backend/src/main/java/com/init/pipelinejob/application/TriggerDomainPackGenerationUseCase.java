package com.init.pipelinejob.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.pipelinejob.application.exception.DatasetNotFoundException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyRunningException;
import com.init.pipelinejob.application.exception.PipelineJobWorkspaceAccessDeniedException;
import com.init.pipelinejob.application.exception.PipelineJobWorkspaceNotFoundException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.shared.application.exception.NotFoundException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

// NOTE: 선언적 @Transactional 대신 TransactionTemplate을 사용한다.
// Airflow trigger(외부 호출)와 DB 상태 갱신을 2-phase로 interleave해야 하므로
// 클래스 레벨 @Transactional(readOnly = true) 컨벤션의 의도적 예외.
@Service
public class TriggerDomainPackGenerationUseCase {

  private static final Set<String> ALLOWED_ROLES = Set.of("OWNER", "ADMIN", "OPERATOR");

  private final PipelineJobRepository pipelineJobRepository;
  private final WorkspaceMembershipPort workspaceMembershipPort;
  private final DatasetOwnershipPort datasetOwnershipPort;
  private final DatasetRawFileLookupPort datasetRawFileLookupPort;
  private final DomainPackGenerationConcurrencyGuard concurrencyGuard;
  private final DomainPackGenerationTriggerPort triggerPort;
  private final ObjectMapper objectMapper;
  private final Clock clock;
  private final TransactionTemplate transactionTemplate;

  public TriggerDomainPackGenerationUseCase(
      PipelineJobRepository pipelineJobRepository,
      WorkspaceMembershipPort workspaceMembershipPort,
      DatasetOwnershipPort datasetOwnershipPort,
      DatasetRawFileLookupPort datasetRawFileLookupPort,
      DomainPackGenerationConcurrencyGuard concurrencyGuard,
      DomainPackGenerationTriggerPort triggerPort,
      ObjectMapper objectMapper,
      Clock clock,
      PlatformTransactionManager transactionManager) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.workspaceMembershipPort = workspaceMembershipPort;
    this.datasetOwnershipPort = datasetOwnershipPort;
    this.datasetRawFileLookupPort = datasetRawFileLookupPort;
    this.concurrencyGuard = concurrencyGuard;
    this.triggerPort = triggerPort;
    this.objectMapper = objectMapper;
    this.clock = clock;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
  }

  public TriggerDomainPackGenerationResult execute(TriggerDomainPackGenerationCommand command) {
    CreatedPipelineJob createdJob = createQueuedPipelineJob(command);

    try {
      triggerPort.trigger(
          new DomainPackGenerationTriggerCommand(
              command.workspaceId(),
              command.datasetId(),
              createdJob.pipelineJobId(),
              createdJob.airflowRunId(),
              createdJob.objectKey()));
    } catch (AirflowTriggerFailedException ex) {
      markFailed(createdJob.pipelineJobId(), ex.getMessage());
      throw ex;
    }

    PipelineJob runningJob =
        executeInTransaction(
            () -> {
              PipelineJob job =
                  pipelineJobRepository
                      .findById(createdJob.pipelineJobId())
                      .orElseThrow(
                          () ->
                              new IllegalStateException(
                                  "생성된 pipeline job을 찾을 수 없습니다. id=" + createdJob.pipelineJobId()));
              if (!PipelineJob.STATUS_QUEUED.equals(job.getStatus())) {
                return job;
              }
              job.markAirflowTriggered(OffsetDateTime.now(clock));
              return pipelineJobRepository.saveAndFlush(job);
            });

    return toResult(runningJob);
  }

  private CreatedPipelineJob createQueuedPipelineJob(TriggerDomainPackGenerationCommand command) {
    return executeInTransaction(
        () -> {
          concurrencyGuard.lockTriggerCreation(command.workspaceId(), command.datasetId());
          validateAccess(command);
          pipelineJobRepository
              .findActiveDomainPackGenerationJob(command.workspaceId(), command.datasetId())
              .ifPresent(
                  job -> {
                    throw new PipelineJobAlreadyRunningException(job.getId(), job.getStatus());
                  });

          String dagId = triggerPort.dagId();
          String objectKey = resolveRawFileObjectKey(command.datasetId());
          PipelineJob job =
              PipelineJob.createDomainPackGeneration(
                  command.workspaceId(),
                  command.datasetId(),
                  command.userId(),
                  "{}",
                  OffsetDateTime.now(clock));
          PipelineJob savedJob = pipelineJobRepository.saveAndFlush(job);
          String dagRunId = "pipeline_job_" + savedJob.getId();
          savedJob.assignAirflowRun(
              dagId, dagRunId, buildRequestPayloadJson(command, dagId, dagRunId, objectKey));
          PipelineJob queuedJob = pipelineJobRepository.saveAndFlush(savedJob);
          return new CreatedPipelineJob(queuedJob.getId(), queuedJob.getAirflowRunId(), objectKey);
        });
  }

  private void validateAccess(TriggerDomainPackGenerationCommand command) {
    if (!workspaceMembershipPort.existsById(command.workspaceId())) {
      throw new PipelineJobWorkspaceNotFoundException(
          "Workspace를 찾을 수 없습니다. id=" + command.workspaceId());
    }
    if (!workspaceMembershipPort.hasAnyRole(
        command.workspaceId(), command.userId(), ALLOWED_ROLES)) {
      throw new PipelineJobWorkspaceAccessDeniedException("Domain Pack Generation 실행 권한이 없습니다.");
    }
    if (!datasetOwnershipPort.existsByIdAndWorkspaceId(
        command.datasetId(), command.workspaceId())) {
      throw new DatasetNotFoundException(command.datasetId(), command.workspaceId());
    }
  }

  private String resolveRawFileObjectKey(Long datasetId) {
    return datasetRawFileLookupPort
        .findLatestObjectKeyByDatasetId(datasetId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "RAW_FILE_NOT_FOUND", "Dataset raw file을 찾을 수 없습니다. datasetId=" + datasetId));
  }

  private void markFailed(Long pipelineJobId, String errorMessage) {
    transactionTemplate.executeWithoutResult(
        status -> {
          PipelineJob job =
              pipelineJobRepository
                  .findById(pipelineJobId)
                  .orElseThrow(
                      () ->
                          new IllegalStateException(
                              "생성된 pipeline job을 찾을 수 없습니다. id=" + pipelineJobId));
          if (!job.isFinalized()) {
            job.markFailed(errorMessage, OffsetDateTime.now(clock));
            pipelineJobRepository.saveAndFlush(job);
          }
        });
  }

  private String buildRequestPayloadJson(
      TriggerDomainPackGenerationCommand command, String dagId, String dagRunId, String objectKey) {
    ObjectNode payload = objectMapper.createObjectNode();
    payload.put("workspaceId", command.workspaceId());
    payload.put("datasetId", command.datasetId());
    payload.put("jobType", PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION);
    payload.put("airflowDagId", dagId);
    payload.put("airflowRunId", dagRunId);
    payload.put("requestedBy", command.userId());
    payload.put("objectKey", objectKey);
    try {
      return objectMapper.writeValueAsString(payload);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Pipeline job 요청 payload JSON 생성에 실패했습니다.", ex);
    }
  }

  private TriggerDomainPackGenerationResult toResult(PipelineJob job) {
    return new TriggerDomainPackGenerationResult(
        job.getId(),
        job.getWorkspaceId(),
        job.getDatasetId(),
        job.getJobType(),
        job.getStatus(),
        job.getAirflowDagId(),
        job.getAirflowRunId(),
        job.getRequestedAt(),
        job.getStartedAt());
  }

  private <T> T executeInTransaction(Supplier<T> callback) {
    return transactionTemplate.execute(status -> callback.get());
  }

  private record CreatedPipelineJob(Long pipelineJobId, String airflowRunId, String objectKey) {}
}
