package com.init.review.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.review.application.PipelineReviewCheckpointUseCase;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

@ExtendWith(MockitoExtension.class)
@DisplayName("PipelineReviewController")
class PipelineReviewControllerTest {

  @Mock private PipelineReviewCheckpointUseCase useCase;

  @Test
  @DisplayName("get checkpoint delegates workspace job and authenticated user")
  void getCheckpoint_delegates() {
    PipelineReviewController controller = new PipelineReviewController(useCase);
    PipelineReviewCheckpointUseCase.ReviewCheckpointView view =
        new PipelineReviewCheckpointUseCase.ReviewCheckpointView(
            7L, "WAITING_HUMAN_FEEDBACK", null, List.of());
    given(useCase.getCheckpoint(1L, 7L, 9L)).willReturn(view);

    ResponseEntity<PipelineReviewCheckpointUseCase.ReviewCheckpointView> response =
        controller.getCheckpoint(1L, 7L, auth());

    assertThat(response.getBody()).isSameAs(view);
  }

  @Test
  @DisplayName("confirm domain maps review task and reason")
  void confirmDomain_mapsCommand() {
    PipelineReviewController controller = new PipelineReviewController(useCase);
    given(useCase.confirmDomain(any()))
        .willReturn(new PipelineReviewCheckpointUseCase.ReviewCheckpointResult(55L, "TRIGGERED"));

    controller.confirmDomain(
        1L, 7L, new PipelineReviewController.ConfirmDomainRequest(101L, "대표 도메인"), auth());

    ArgumentCaptor<PipelineReviewCheckpointUseCase.ConfirmDomainCommand> captor =
        ArgumentCaptor.forClass(PipelineReviewCheckpointUseCase.ConfirmDomainCommand.class);
    verify(useCase).confirmDomain(captor.capture());
    assertThat(captor.getValue().workspaceId()).isEqualTo(1L);
    assertThat(captor.getValue().pipelineJobId()).isEqualTo(7L);
    assertThat(captor.getValue().reviewTaskId()).isEqualTo(101L);
    assertThat(captor.getValue().userId()).isEqualTo(9L);
    assertThat(captor.getValue().reason()).isEqualTo("대표 도메인");
  }

  @Test
  @DisplayName("submit feedback maps all pairwise decisions")
  void submitFeedback_mapsCommand() {
    PipelineReviewController controller = new PipelineReviewController(useCase);
    given(useCase.submitFeedback(any()))
        .willReturn(new PipelineReviewCheckpointUseCase.ReviewCheckpointResult(56L, "TRIGGERED"));

    controller.submitFeedback(
        1L,
        7L,
        new PipelineReviewController.SubmitFeedbackRequest(
            List.of(
                new PipelineReviewController.FeedbackDecisionRequest(201L, "same", "같음"),
                new PipelineReviewController.FeedbackDecisionRequest(202L, "different", "다름"))),
        auth());

    ArgumentCaptor<PipelineReviewCheckpointUseCase.SubmitFeedbackCommand> captor =
        ArgumentCaptor.forClass(PipelineReviewCheckpointUseCase.SubmitFeedbackCommand.class);
    verify(useCase).submitFeedback(captor.capture());
    assertThat(captor.getValue().workspaceId()).isEqualTo(1L);
    assertThat(captor.getValue().pipelineJobId()).isEqualTo(7L);
    assertThat(captor.getValue().userId()).isEqualTo(9L);
    assertThat(captor.getValue().decisions()).hasSize(2);
    assertThat(captor.getValue().decisions().getFirst().decisionType()).isEqualTo("same");
  }

  private UsernamePasswordAuthenticationToken auth() {
    return new UsernamePasswordAuthenticationToken(9L, null, List.of());
  }
}
