package com.init.pipelinejob.infrastructure.persistence;

import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaPipelineJobRepository
    extends JpaRepository<PipelineJob, Long>, PipelineJobRepository {

  @Override
  default Optional<PipelineJob> findActiveDomainPackGenerationJob(
      Long workspaceId, Long datasetId) {
    return findFirstByWorkspaceIdAndDatasetIdAndJobTypeAndStatusInOrderByRequestedAtDesc(
        workspaceId,
        datasetId,
        PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION,
        List.of(
            PipelineJob.STATUS_QUEUED,
            PipelineJob.STATUS_RUNNING,
            PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION,
            PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK,
            PipelineJob.STATUS_WAITING_INTENT_CALLBACK,
            PipelineJob.STATUS_WAITING_WORKFLOW_CALLBACK));
  }

  Optional<PipelineJob>
      findFirstByWorkspaceIdAndDatasetIdAndJobTypeAndStatusInOrderByRequestedAtDesc(
          Long workspaceId, Long datasetId, String jobType, List<String> statuses);

  @Override
  default Optional<PipelineJob> findLatestByWorkspaceIdAndDatasetIdAndJobType(
      Long workspaceId, Long datasetId, String jobType) {
    return findFirstByWorkspaceIdAndDatasetIdAndJobTypeOrderByRequestedAtDesc(
        workspaceId, datasetId, jobType);
  }

  Optional<PipelineJob> findFirstByWorkspaceIdAndDatasetIdAndJobTypeOrderByRequestedAtDesc(
      Long workspaceId, Long datasetId, String jobType);

  @Override
  @Query(
      """
      select j
      from PipelineJob j
      where (cast(:status as string) is null or j.status = cast(:status as string))
        and (:workspaceId is null or j.workspaceId = :workspaceId)
        and (cast(:dagId as string) is null or lower(j.airflowDagId) like lower(concat('%', cast(:dagId as string), '%')))
        and (cast(:runId as string) is null or lower(j.airflowRunId) like lower(concat('%', cast(:runId as string), '%')))
      order by j.requestedAt desc
      """)
  Page<PipelineJob> findAdminPipelineJobs(
      @Param("status") String status,
      @Param("workspaceId") Long workspaceId,
      @Param("dagId") String dagId,
      @Param("runId") String runId,
      Pageable pageable);

  @Override
  List<PipelineJob> findAllByRetriedFromJobIdInOrderByRequestedAtDesc(
      Collection<Long> retriedFromJobIds);
}
