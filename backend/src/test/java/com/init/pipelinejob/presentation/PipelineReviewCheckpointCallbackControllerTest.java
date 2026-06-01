package com.init.pipelinejob.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.presentation.dto.PipelineReviewCheckpointCallbackRequest;
import com.init.pipelinejob.presentation.dto.PipelineReviewCheckpointCallbackResponse;
import com.init.review.application.PipelineReviewCheckpointUseCase;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
@DisplayName("PipelineReviewCheckpointCallbackController")
class PipelineReviewCheckpointCallbackControllerTest {

  @Mock private PipelineReviewCheckpointUseCase useCase;
  @Mock private HttpServletRequest request;

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  @DisplayName("domain checkpoint maps request payload to callback command")
  void receiveDomainCheckpoint_mapsRequestToCommand() {
    PipelineReviewCheckpointCallbackController controller =
        new PipelineReviewCheckpointCallbackController(useCase, objectMapper);
    ObjectNode candidates = objectMapper.createObjectNode();
    candidates.putArray("candidates").addObject();
    PipelineReviewCheckpointCallbackRequest payload =
        requestPayload("/artifacts/domain.json", candidates, null, null);
    given(request.getHeaderNames()).willReturn(Collections.emptyEnumeration());
    given(useCase.receiveDomainConfirmationCheckpoint(any()))
        .willReturn(
            new PipelineReviewCheckpointUseCase.CheckpointCallbackResult("CREATED", "evt-1"));

    ResponseEntity<PipelineReviewCheckpointCallbackResponse> response =
        controller.receiveDomainCheckpoint(7L, "secret", payload, request);

    ArgumentCaptor<PipelineReviewCheckpointUseCase.CheckpointCallbackCommand> captor =
        ArgumentCaptor.forClass(PipelineReviewCheckpointUseCase.CheckpointCallbackCommand.class);
    verify(useCase).receiveDomainConfirmationCheckpoint(captor.capture());
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    assertThat(response.getBody().externalEventId()).isEqualTo("evt-1");
    assertThat(captor.getValue().artifactPath()).isEqualTo("/artifacts/domain.json");
    assertThat(captor.getValue().artifactPayload()).isEqualTo(candidates);
  }

  @Test
  @DisplayName("human feedback duplicate checkpoint returns OK")
  void receiveHumanFeedbackCheckpoint_duplicateReturnsOk() {
    PipelineReviewCheckpointCallbackController controller =
        new PipelineReviewCheckpointCallbackController(useCase, objectMapper);
    ObjectNode questions = objectMapper.createObjectNode();
    questions.putArray("questions").addObject();
    PipelineReviewCheckpointCallbackRequest payload =
        requestPayload(null, null, "/artifacts/feedback.json", questions);
    given(request.getHeaderNames()).willReturn(Collections.emptyEnumeration());
    given(useCase.receiveHumanFeedbackCheckpoint(any()))
        .willReturn(
            new PipelineReviewCheckpointUseCase.CheckpointCallbackResult(
                "DUPLICATE_IGNORED", "evt-1"));

    ResponseEntity<PipelineReviewCheckpointCallbackResponse> response =
        controller.receiveHumanFeedbackCheckpoint(7L, null, payload, request);

    ArgumentCaptor<PipelineReviewCheckpointUseCase.CheckpointCallbackCommand> captor =
        ArgumentCaptor.forClass(PipelineReviewCheckpointUseCase.CheckpointCallbackCommand.class);
    verify(useCase).receiveHumanFeedbackCheckpoint(captor.capture());
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody().status()).isEqualTo("DUPLICATE_IGNORED");
    assertThat(captor.getValue().artifactPath()).isEqualTo("/artifacts/feedback.json");
    assertThat(captor.getValue().artifactPayload()).isEqualTo(questions);
  }

  private PipelineReviewCheckpointCallbackRequest requestPayload(
      String domainCandidatesPath,
      ObjectNode domainCandidates,
      String feedbackQuestionsPath,
      ObjectNode feedbackQuestions) {
    return new PipelineReviewCheckpointCallbackRequest(
        "evt-1",
        "domain_pack_generation",
        "run-1",
        "INITIAL",
        null,
        "/artifacts/upstream/manifest.json",
        domainCandidatesPath,
        feedbackQuestionsPath,
        domainCandidates,
        feedbackQuestions);
  }
}
