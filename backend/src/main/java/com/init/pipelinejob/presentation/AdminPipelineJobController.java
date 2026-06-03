package com.init.pipelinejob.presentation;

import com.init.pipelinejob.application.GetAdminPipelineJobListQuery;
import com.init.pipelinejob.application.GetAdminPipelineJobListUseCase;
import com.init.pipelinejob.application.RetryAdminPipelineJobResult;
import com.init.pipelinejob.application.RetryAdminPipelineJobUseCase;
import com.init.pipelinejob.presentation.dto.AdminPipelineJobListResponse;
import com.init.pipelinejob.presentation.dto.RetryAdminPipelineJobResponse;
import com.init.shared.presentation.AuthenticationUtils;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/pipeline-jobs")
public class AdminPipelineJobController {

  private static final long DEFAULT_LAG_THRESHOLD_SECONDS = 300;

  private final GetAdminPipelineJobListUseCase getAdminPipelineJobListUseCase;
  private final RetryAdminPipelineJobUseCase retryAdminPipelineJobUseCase;

  public AdminPipelineJobController(
      GetAdminPipelineJobListUseCase getAdminPipelineJobListUseCase,
      RetryAdminPipelineJobUseCase retryAdminPipelineJobUseCase) {
    this.getAdminPipelineJobListUseCase = getAdminPipelineJobListUseCase;
    this.retryAdminPipelineJobUseCase = retryAdminPipelineJobUseCase;
  }

  @GetMapping
  public AdminPipelineJobListResponse list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) Long workspaceId,
      @RequestParam(required = false) String dagId,
      @RequestParam(required = false) String runId,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
      @RequestParam(defaultValue = "300") @Min(1) long lagThresholdSeconds) {
    return AdminPipelineJobListResponse.from(
        getAdminPipelineJobListUseCase.execute(
            new GetAdminPipelineJobListQuery(
                status,
                workspaceId,
                dagId,
                runId,
                page,
                size,
                lagThresholdSecondsOrDefault(lagThresholdSeconds))));
  }

  @PostMapping("/{pipelineJobId}/retry")
  @ResponseStatus(HttpStatus.CREATED)
  public RetryAdminPipelineJobResponse retry(
      @PathVariable Long pipelineJobId, Authentication authentication) {
    Long adminUserId = AuthenticationUtils.getUserId(authentication);
    RetryAdminPipelineJobResult result =
        retryAdminPipelineJobUseCase.execute(pipelineJobId, adminUserId);
    return RetryAdminPipelineJobResponse.from(result);
  }

  private long lagThresholdSecondsOrDefault(long lagThresholdSeconds) {
    return lagThresholdSeconds > 0 ? lagThresholdSeconds : DEFAULT_LAG_THRESHOLD_SECONDS;
  }
}
