package com.init.pipelinejob.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
import com.init.pipelinejob.application.exception.PipelineJobRetryInputMissingException;
import com.init.pipelinejob.application.exception.PipelineJobRetryNotAllowedException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import org.springframework.stereotype.Service;

@Service
public class RetryAdminPipelineJobUseCase {

  private final PipelineJobRepository pipelineJobRepository;
  private final TriggerDomainPackGenerationUseCase triggerDomainPackGenerationUseCase;
  private final ObjectMapper objectMapper;

  public RetryAdminPipelineJobUseCase(
      PipelineJobRepository pipelineJobRepository,
      TriggerDomainPackGenerationUseCase triggerDomainPackGenerationUseCase,
      ObjectMapper objectMapper) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.triggerDomainPackGenerationUseCase = triggerDomainPackGenerationUseCase;
    this.objectMapper = objectMapper;
  }

  public RetryAdminPipelineJobResult execute(Long sourcePipelineJobId, Long adminUserId) {
    PipelineJob sourceJob =
        pipelineJobRepository
            .findById(sourcePipelineJobId)
            .orElseThrow(() -> new PipelineJobNotFoundException(sourcePipelineJobId));
    validateRetryAllowed(sourceJob);

    String objectKey = extractOriginalObjectKey(sourceJob);
    TriggerDomainPackGenerationResult retry =
        triggerDomainPackGenerationUseCase.execute(
            TriggerDomainPackGenerationCommand.adminRetry(
                sourceJob.getWorkspaceId(),
                sourceJob.getDatasetId(),
                adminUserId,
                objectKey,
                sourceJob.getId()));

    return new RetryAdminPipelineJobResult(
        sourceJob.getId(),
        retry.pipelineJobId(),
        retry.workspaceId(),
        retry.datasetId(),
        retry.jobType(),
        retry.status(),
        retry.airflowDagId(),
        retry.airflowRunId(),
        retry.requestedAt(),
        retry.startedAt());
  }

  private void validateRetryAllowed(PipelineJob sourceJob) {
    if (!sourceJob.isFailed()) {
      throw new PipelineJobRetryNotAllowedException(sourceJob.getId(), "FAILED 상태만 재시도할 수 있습니다.");
    }
    if (!PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION.equals(sourceJob.getJobType())) {
      throw new PipelineJobRetryNotAllowedException(
          sourceJob.getId(), "Domain Pack generation job만 재시도할 수 있습니다.");
    }
    if (sourceJob.getDatasetId() == null) {
      throw new PipelineJobRetryInputMissingException(sourceJob.getId(), "datasetId");
    }
  }

  private String extractOriginalObjectKey(PipelineJob sourceJob) {
    try {
      String objectKey =
          objectMapper.readTree(sourceJob.getRequestPayloadJson()).path("objectKey").asText();
      if (objectKey == null || objectKey.isBlank()) {
        throw new PipelineJobRetryInputMissingException(sourceJob.getId(), "objectKey");
      }
      return objectKey;
    } catch (JsonProcessingException ex) {
      throw new PipelineJobRetryInputMissingException(sourceJob.getId(), "requestPayloadJson");
    }
  }
}
