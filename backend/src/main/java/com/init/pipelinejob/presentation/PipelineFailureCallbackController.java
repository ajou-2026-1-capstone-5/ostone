package com.init.pipelinejob.presentation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.application.ReceivePipelineJobFailureCallbackCommand;
import com.init.pipelinejob.application.ReceivePipelineJobFailureCallbackResult;
import com.init.pipelinejob.application.ReceivePipelineJobFailureCallbackUseCase;
import com.init.pipelinejob.presentation.dto.PipelineFailureCallbackRequest;
import com.init.pipelinejob.presentation.dto.PipelineFailureCallbackResponse;
import com.init.shared.infrastructure.web.WebhookHeaderNames;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pipeline-jobs")
public class PipelineFailureCallbackController {

  private final ReceivePipelineJobFailureCallbackUseCase failureCallbackUseCase;
  private final ObjectMapper objectMapper;

  public PipelineFailureCallbackController(
      ReceivePipelineJobFailureCallbackUseCase failureCallbackUseCase, ObjectMapper objectMapper) {
    this.failureCallbackUseCase = failureCallbackUseCase;
    this.objectMapper = objectMapper;
  }

  @PostMapping("/{jobId}/callbacks/failures")
  public ResponseEntity<PipelineFailureCallbackResponse> receiveFailureCallback(
      @PathVariable Long jobId,
      @RequestHeader(value = WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, required = false)
          String webhookSecret,
      @Valid @RequestBody PipelineFailureCallbackRequest request,
      HttpServletRequest httpServletRequest) {
    ReceivePipelineJobFailureCallbackResult result =
        failureCallbackUseCase.execute(
            new ReceivePipelineJobFailureCallbackCommand(
                jobId,
                webhookSecret,
                request.externalEventId(),
                request.dagId(),
                request.dagRunId(),
                request.failedStage(),
                request.reason(),
                request.message(),
                request.occurredAt(),
                objectMapper
                    .valueToTree(WebhookRequestHeaders.extractMasked(httpServletRequest))
                    .toString(),
                objectMapper.valueToTree(request).toString()));

    return ResponseEntity.ok(
        new PipelineFailureCallbackResponse(
            result.status(), result.externalEventId(), result.pipelineJobId(), result.jobStatus()));
  }
}
