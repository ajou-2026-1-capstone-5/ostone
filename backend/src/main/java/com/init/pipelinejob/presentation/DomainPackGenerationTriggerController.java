package com.init.pipelinejob.presentation;

import com.init.pipelinejob.application.TriggerDomainPackGenerationCommand;
import com.init.pipelinejob.application.TriggerDomainPackGenerationResult;
import com.init.pipelinejob.application.TriggerDomainPackGenerationUseCase;
import com.init.pipelinejob.presentation.dto.DomainPackGenerationTriggerResponse;
import com.init.shared.presentation.AuthenticationUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/datasets/{datasetId}/pipeline-jobs")
public class DomainPackGenerationTriggerController {

  private final TriggerDomainPackGenerationUseCase triggerDomainPackGenerationUseCase;

  public DomainPackGenerationTriggerController(
      TriggerDomainPackGenerationUseCase triggerDomainPackGenerationUseCase) {
    this.triggerDomainPackGenerationUseCase = triggerDomainPackGenerationUseCase;
  }

  @PostMapping("/domain-pack-generation")
  public ResponseEntity<DomainPackGenerationTriggerResponse> triggerDomainPackGeneration(
      @PathVariable Long workspaceId, @PathVariable Long datasetId, Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    TriggerDomainPackGenerationResult result =
        triggerDomainPackGenerationUseCase.execute(
            new TriggerDomainPackGenerationCommand(workspaceId, datasetId, userId));
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(
            new DomainPackGenerationTriggerResponse(
                result.pipelineJobId(),
                result.workspaceId(),
                result.datasetId(),
                result.jobType(),
                result.status(),
                result.airflowDagId(),
                result.airflowRunId(),
                result.requestedAt(),
                result.startedAt()));
  }
}
