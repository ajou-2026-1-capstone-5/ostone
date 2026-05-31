package com.init.review.presentation;

import com.init.review.application.PipelineReviewCheckpointUseCase;
import com.init.shared.presentation.AuthenticationUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/pipeline-jobs/{pipelineJobId}/review-checkpoint")
public class PipelineReviewController {

  private final PipelineReviewCheckpointUseCase useCase;

  public PipelineReviewController(PipelineReviewCheckpointUseCase useCase) {
    this.useCase = useCase;
  }

  @GetMapping
  public ResponseEntity<PipelineReviewCheckpointUseCase.ReviewCheckpointView> getCheckpoint(
      @PathVariable Long workspaceId,
      @PathVariable Long pipelineJobId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(useCase.getCheckpoint(workspaceId, pipelineJobId, userId));
  }

  @PostMapping("/domain-confirmation")
  public ResponseEntity<PipelineReviewCheckpointUseCase.ReviewCheckpointResult> confirmDomain(
      @PathVariable Long workspaceId,
      @PathVariable Long pipelineJobId,
      @Valid @RequestBody ConfirmDomainRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        useCase.confirmDomain(
            new PipelineReviewCheckpointUseCase.ConfirmDomainCommand(
                workspaceId, pipelineJobId, request.reviewTaskId(), userId, request.reason())));
  }

  @PostMapping("/human-feedback")
  public ResponseEntity<PipelineReviewCheckpointUseCase.ReviewCheckpointResult> submitFeedback(
      @PathVariable Long workspaceId,
      @PathVariable Long pipelineJobId,
      @Valid @RequestBody SubmitFeedbackRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        useCase.submitFeedback(
            new PipelineReviewCheckpointUseCase.SubmitFeedbackCommand(
                workspaceId,
                pipelineJobId,
                userId,
                request.decisions().stream()
                    .map(
                        decision ->
                            new PipelineReviewCheckpointUseCase.FeedbackDecisionInput(
                                decision.reviewTaskId(),
                                decision.decisionType(),
                                decision.reason()))
                    .toList())));
  }

  public record ConfirmDomainRequest(@NotNull Long reviewTaskId, String reason) {}

  public record SubmitFeedbackRequest(@NotEmpty List<FeedbackDecisionRequest> decisions) {}

  public record FeedbackDecisionRequest(
      @NotNull Long reviewTaskId, @NotNull String decisionType, String reason) {}
}
