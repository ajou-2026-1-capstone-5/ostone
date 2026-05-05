package com.init.pipelinejob.infrastructure.persistence;

import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
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
            PipelineJob.STATUS_WAITING_INTENT_CALLBACK,
            PipelineJob.STATUS_WAITING_WORKFLOW_CALLBACK));
  }

  Optional<PipelineJob>
      findFirstByWorkspaceIdAndDatasetIdAndJobTypeAndStatusInOrderByRequestedAtDesc(
          Long workspaceId, Long datasetId, String jobType, List<String> statuses);
}
