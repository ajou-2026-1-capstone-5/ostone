package com.init.pipelinejob.presentation;

import com.init.pipelinejob.application.GetLatestPipelineJobQuery;
import com.init.pipelinejob.application.GetLatestPipelineJobUseCase;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.presentation.dto.LatestPipelineJobResponse;
import com.init.shared.presentation.AuthenticationUtils;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/datasets/{datasetId}/pipeline-jobs")
public class PipelineJobStatusController {

  private final GetLatestPipelineJobUseCase getLatestPipelineJobUseCase;

  public PipelineJobStatusController(GetLatestPipelineJobUseCase getLatestPipelineJobUseCase) {
    this.getLatestPipelineJobUseCase = getLatestPipelineJobUseCase;
  }

  @GetMapping("/latest")
  public LatestPipelineJobResponse getLatest(
      @PathVariable Long workspaceId,
      @PathVariable Long datasetId,
      @RequestParam(defaultValue = PipelineJob.JOB_TYPE_INGESTION) String jobType,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return getLatestPipelineJobUseCase
        .execute(new GetLatestPipelineJobQuery(workspaceId, datasetId, jobType, userId))
        .map(LatestPipelineJobResponse::from)
        .orElseGet(LatestPipelineJobResponse::empty);
  }
}
