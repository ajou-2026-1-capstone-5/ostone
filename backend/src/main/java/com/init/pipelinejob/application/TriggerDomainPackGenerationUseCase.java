package com.init.pipelinejob.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.pipelinejob.application.exception.DatasetNotFoundException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyRunningException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.application.exception.WorkspaceNotFoundException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class TriggerDomainPackGenerationUseCase {

  private static final Set<String> ALLOWED_ROLES = Set.of("OWNER", "ADMIN", "OPERATOR");

  private final PipelineJobRepository pipelineJobRepository;
  private final WorkspaceMembershipPort workspaceMembershipPort;
  private final DatasetOwnershipPort datasetOwnershipPort;
  private final DomainPackGenerationConcurrencyGuard concurrencyGuard;
  private final DomainPackGenerationTriggerPort triggerPort;
  private final ObjectMapper objectMapper;
  private final Clock clock;
  private final TransactionTemplate transactionTemplate;

  public TriggerDomainPackGenerationUseCase(
      PipelineJobRepository pipelineJobRepository,
      WorkspaceMembershipPort workspaceMembershipPort,
      DatasetOwnershipPort datasetOwnershipPort,
      DomainPackGenerationConcurrencyGuard concurrencyGuard,
      DomainPackGenerationTriggerPort triggerPort,
      ObjectMapper objectMapper,
      Clock clock,
      PlatformTransactionManager transactionManager) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.workspaceMembershipPort = workspaceMembershipPort;
    this.datasetOwnershipPort = datasetOwnershipPort;
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
              createdJob.airflowRunId()));
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
              job.markAirflowTriggered(OffsetDateTime.now(clock));
              return pipelineJobRepository.saveAndFlush(job);
            });

    return toResult(runningJob);
  }

  private CreatedPipelineJob createQueuedPipelineJob(TriggerDomainPackGenerationCommand command) {
    String dagId = triggerPort.dagId();
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

          PipelineJob job =
              PipelineJob.createDomainPackGeneration(
                  command.workspaceId(), command.datasetId(), command.userId(), "{}");
          PipelineJob savedJob = pipelineJobRepository.saveAndFlush(job);
          String dagRunId = "pipeline_job_" + savedJob.getId();
          savedJob.assignAirflowRun(
              dagId, dagRunId, buildRequestPayloadJson(command, dagId, dagRunId));
          PipelineJob queuedJob = pipelineJobRepository.saveAndFlush(savedJob);
          return new CreatedPipelineJob(queuedJob.getId(), queuedJob.getAirflowRunId());
        });
  }

  private void validateAccess(TriggerDomainPackGenerationCommand command) {
    if (!workspaceMembershipPort.existsById(command.workspaceId())) {
      throw new WorkspaceNotFoundException("Workspace를 찾을 수 없습니다. id=" + command.workspaceId());
    }
    if (!workspaceMembershipPort.hasAnyRole(
        command.workspaceId(), command.userId(), ALLOWED_ROLES)) {
      throw new WorkspaceAccessDeniedException("Domain Pack Generation 실행 권한이 없습니다.");
    }
    if (!datasetOwnershipPort.existsByIdAndWorkspaceId(
        command.datasetId(), command.workspaceId())) {
      throw new DatasetNotFoundException(command.datasetId(), command.workspaceId());
    }
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
      TriggerDomainPackGenerationCommand command, String dagId, String dagRunId) {
    ObjectNode payload = objectMapper.createObjectNode();
    payload.put("workspaceId", command.workspaceId());
    payload.put("datasetId", command.datasetId());
    payload.put("jobType", PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION);
    payload.put("airflowDagId", dagId);
    payload.put("airflowRunId", dagRunId);
    payload.put("requestedBy", command.userId());
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

  private record CreatedPipelineJob(Long pipelineJobId, String airflowRunId) {}
}
