package com.init.pipelinejob.application;

import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetLatestPipelineJobUseCase {

  private static final Set<String> ALLOWED_ROLES = Set.of("OWNER", "ADMIN", "OPERATOR");
  private static final Set<String> ALLOWED_JOB_TYPES =
      Set.of(PipelineJob.JOB_TYPE_INGESTION, PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION);

  private final PipelineJobRepository pipelineJobRepository;
  private final WorkspaceMembershipPort workspaceMembershipPort;
  private final DatasetOwnershipPort datasetOwnershipPort;
  private final Clock clock;

  public GetLatestPipelineJobUseCase(
      PipelineJobRepository pipelineJobRepository,
      WorkspaceMembershipPort workspaceMembershipPort,
      DatasetOwnershipPort datasetOwnershipPort,
      Clock clock) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.workspaceMembershipPort = workspaceMembershipPort;
    this.datasetOwnershipPort = datasetOwnershipPort;
    this.clock = clock;
  }

  public Optional<GetLatestPipelineJobResult> execute(GetLatestPipelineJobQuery query) {
    validateRequiredQuery(query);
    String jobType = normalizeJobType(query.jobType());
    validateAccess(query.workspaceId(), query.datasetId(), query.userId());
    OffsetDateTime now = OffsetDateTime.now(clock);
    return pipelineJobRepository
        .findLatestByWorkspaceIdAndDatasetIdAndJobType(
            query.workspaceId(), query.datasetId(), jobType)
        .map(job -> toResult(job, now));
  }

  private void validateRequiredQuery(GetLatestPipelineJobQuery query) {
    if (query == null
        || query.workspaceId() == null
        || query.workspaceId() <= 0
        || query.datasetId() == null
        || query.datasetId() <= 0
        || query.userId() == null
        || query.userId() <= 0) {
      throw new BadRequestException(
          "PIPELINE_JOB_QUERY_INVALID", "pipeline job 조회 요청 값이 올바르지 않습니다.");
    }
  }

  private String normalizeJobType(String jobType) {
    String normalized =
        jobType == null || jobType.isBlank() ? PipelineJob.JOB_TYPE_INGESTION : jobType.trim();
    if (!ALLOWED_JOB_TYPES.contains(normalized)) {
      throw new BadRequestException("PIPELINE_JOB_TYPE_INVALID", "지원하지 않는 pipeline job type입니다.");
    }
    return normalized;
  }

  private void validateAccess(Long workspaceId, Long datasetId, Long userId) {
    if (!workspaceMembershipPort.existsById(workspaceId)) {
      throw new NotFoundException("WORKSPACE_NOT_FOUND", "Workspace를 찾을 수 없습니다.");
    }
    if (!workspaceMembershipPort.hasAnyRole(workspaceId, userId, ALLOWED_ROLES)) {
      throw new NotFoundException("DATASET_NOT_FOUND", "Dataset을 찾을 수 없습니다.");
    }
    if (!datasetOwnershipPort.existsByIdAndWorkspaceId(datasetId, workspaceId)) {
      throw new NotFoundException("DATASET_NOT_FOUND", "Dataset을 찾을 수 없습니다.");
    }
  }

  private GetLatestPipelineJobResult toResult(PipelineJob job, OffsetDateTime now) {
    return new GetLatestPipelineJobResult(
        job.getId(),
        job.getWorkspaceId(),
        job.getDatasetId(),
        job.getDomainPackId(),
        job.getJobType(),
        job.getStatus(),
        job.getAirflowDagId(),
        job.getAirflowRunId(),
        job.getRequestedAt(),
        job.getStartedAt(),
        job.getFinishedAt(),
        runningDurationSeconds(job, now),
        job.getLastErrorMessage());
  }

  private Long runningDurationSeconds(PipelineJob job, OffsetDateTime now) {
    if (job.getStartedAt() == null || job.isFinalized()) {
      return null;
    }
    return Math.max(0, Duration.between(job.getStartedAt(), now).getSeconds());
  }
}
