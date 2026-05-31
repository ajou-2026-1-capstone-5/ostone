package com.init.pipelinejob.presentation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.presentation.dto.PipelineReviewCheckpointCallbackRequest;
import com.init.pipelinejob.presentation.dto.PipelineReviewCheckpointCallbackResponse;
import com.init.review.application.PipelineReviewCheckpointUseCase;
import com.init.shared.infrastructure.web.WebhookHeaderNames;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pipeline-jobs")
public class PipelineReviewCheckpointCallbackController {

  private final PipelineReviewCheckpointUseCase useCase;
  private final ObjectMapper objectMapper;

  public PipelineReviewCheckpointCallbackController(
      PipelineReviewCheckpointUseCase useCase, ObjectMapper objectMapper) {
    this.useCase = useCase;
    this.objectMapper = objectMapper;
  }

  @PostMapping("/{jobId}/callbacks/domain-confirmation-checkpoints")
  public ResponseEntity<PipelineReviewCheckpointCallbackResponse> receiveDomainCheckpoint(
      @PathVariable Long jobId,
      @RequestHeader(value = WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, required = false)
          String webhookSecret,
      @Valid @RequestBody PipelineReviewCheckpointCallbackRequest request,
      HttpServletRequest httpServletRequest) {
    PipelineReviewCheckpointUseCase.CheckpointCallbackResult result =
        useCase.receiveDomainConfirmationCheckpoint(
            command(
                jobId,
                webhookSecret,
                request,
                request.domainCandidatesPath(),
                request.domainCandidates(),
                httpServletRequest));
    return response(result);
  }

  @PostMapping("/{jobId}/callbacks/human-feedback-checkpoints")
  public ResponseEntity<PipelineReviewCheckpointCallbackResponse> receiveHumanFeedbackCheckpoint(
      @PathVariable Long jobId,
      @RequestHeader(value = WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, required = false)
          String webhookSecret,
      @Valid @RequestBody PipelineReviewCheckpointCallbackRequest request,
      HttpServletRequest httpServletRequest) {
    PipelineReviewCheckpointUseCase.CheckpointCallbackResult result =
        useCase.receiveHumanFeedbackCheckpoint(
            command(
                jobId,
                webhookSecret,
                request,
                request.feedbackQuestionsPath(),
                request.feedbackQuestions(),
                httpServletRequest));
    return response(result);
  }

  private PipelineReviewCheckpointUseCase.CheckpointCallbackCommand command(
      Long jobId,
      String webhookSecret,
      PipelineReviewCheckpointCallbackRequest request,
      String artifactPath,
      JsonNode artifactPayload,
      HttpServletRequest httpServletRequest) {
    return new PipelineReviewCheckpointUseCase.CheckpointCallbackCommand(
        jobId,
        webhookSecret,
        request.externalEventId(),
        request.dagId(),
        request.dagRunId(),
        request.runMode(),
        request.parentPipelineJobId(),
        request.upstreamManifestPath(),
        artifactPath,
        artifactPayload == null ? objectMapper.createObjectNode() : artifactPayload,
        objectMapper
            .valueToTree(WebhookRequestHeaders.extractMasked(httpServletRequest))
            .toString(),
        objectMapper.valueToTree(request).toString());
  }

  private ResponseEntity<PipelineReviewCheckpointCallbackResponse> response(
      PipelineReviewCheckpointUseCase.CheckpointCallbackResult result) {
    HttpStatus status =
        "DUPLICATE_IGNORED".equals(result.status()) ? HttpStatus.OK : HttpStatus.CREATED;
    return ResponseEntity.status(status)
        .body(
            new PipelineReviewCheckpointCallbackResponse(
                result.status(), result.externalEventId()));
  }
}
