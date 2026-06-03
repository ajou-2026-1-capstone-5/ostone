package com.init.pipelinejob.domain.repository;

import com.init.pipelinejob.domain.model.PipelineJob;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PipelineJobRepository {

  Optional<PipelineJob> findById(Long id);

  Optional<PipelineJob> findActiveDomainPackGenerationJob(Long workspaceId, Long datasetId);

  Page<PipelineJob> findAdminPipelineJobs(
      String status, Long workspaceId, String dagId, String runId, Pageable pageable);

  List<PipelineJob> findAllByRetriedFromJobIdInOrderByRequestedAtDesc(
      Collection<Long> retriedFromJobIds);

  PipelineJob saveAndFlush(PipelineJob pipelineJob);
}
