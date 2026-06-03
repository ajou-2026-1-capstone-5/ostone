package com.init.pipelinejob.application;

import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetAdminPipelineJobListUseCase {

  private final PipelineJobRepository pipelineJobRepository;
  private final Clock clock;

  public GetAdminPipelineJobListUseCase(PipelineJobRepository pipelineJobRepository, Clock clock) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.clock = clock;
  }

  public AdminPipelineJobListResult execute(GetAdminPipelineJobListQuery query) {
    var pageRequest = PageRequest.of(query.page(), query.size());
    var page =
        pipelineJobRepository.findAdminPipelineJobs(
            blankToNull(query.status()),
            query.workspaceId(),
            blankToNull(query.dagId()),
            blankToNull(query.runId()),
            pageRequest);
    Map<Long, Long> retryJobIdsBySource = findRetryJobIdsBySource(page.getContent());
    OffsetDateTime now = OffsetDateTime.now(clock);
    List<AdminPipelineJobListResult.Item> items =
        page.getContent().stream()
            .map(
                job ->
                    toItem(
                        job,
                        retryJobIdsBySource.get(job.getId()),
                        now,
                        query.lagThresholdSeconds()))
            .toList();

    return new AdminPipelineJobListResult(
        items, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
  }

  private Map<Long, Long> findRetryJobIdsBySource(List<PipelineJob> jobs) {
    List<Long> sourceIds = jobs.stream().map(PipelineJob::getId).toList();
    if (sourceIds.isEmpty()) {
      return Map.of();
    }
    Map<Long, Long> retryJobIdsBySource = new HashMap<>();
    pipelineJobRepository.findAllByRetriedFromJobIdInOrderByRequestedAtDesc(sourceIds).stream()
        .filter(job -> job.getRetriedFromJobId() != null)
        .forEach(job -> retryJobIdsBySource.putIfAbsent(job.getRetriedFromJobId(), job.getId()));
    return retryJobIdsBySource;
  }

  private AdminPipelineJobListResult.Item toItem(
      PipelineJob job, Long retryPipelineJobId, OffsetDateTime now, long lagThresholdSeconds) {
    Long queueLagSeconds = queueLagSeconds(job, now);
    Long runningDurationSeconds = runningDurationSeconds(job, now);
    Long totalDurationSeconds = totalDurationSeconds(job);
    return new AdminPipelineJobListResult.Item(
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
        queueLagSeconds,
        runningDurationSeconds,
        totalDurationSeconds,
        queueLagSeconds != null && queueLagSeconds > lagThresholdSeconds,
        job.getLastErrorMessage(),
        job.getRetriedFromJobId(),
        retryPipelineJobId);
  }

  private Long queueLagSeconds(PipelineJob job, OffsetDateTime now) {
    if (job.getStartedAt() != null) {
      return secondsBetween(job.getRequestedAt(), job.getStartedAt());
    }
    if (PipelineJob.STATUS_QUEUED.equals(job.getStatus())) {
      return secondsBetween(job.getRequestedAt(), now);
    }
    return null;
  }

  private Long runningDurationSeconds(PipelineJob job, OffsetDateTime now) {
    if (job.getStartedAt() == null || job.isFinalized()) {
      return null;
    }
    return secondsBetween(job.getStartedAt(), now);
  }

  private Long totalDurationSeconds(PipelineJob job) {
    if (job.getFinishedAt() == null) {
      return null;
    }
    return secondsBetween(job.getRequestedAt(), job.getFinishedAt());
  }

  private Long secondsBetween(OffsetDateTime start, OffsetDateTime end) {
    if (start == null || end == null) {
      return null;
    }
    return Math.max(0, Duration.between(start, end).getSeconds());
  }

  private String blankToNull(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.trim();
  }
}
