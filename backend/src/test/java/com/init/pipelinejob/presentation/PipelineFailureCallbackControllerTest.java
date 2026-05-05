package com.init.pipelinejob.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.pipelinejob.application.ReceivePipelineJobFailureCallbackResult;
import com.init.pipelinejob.application.ReceivePipelineJobFailureCallbackUseCase;
import com.init.pipelinejob.application.exception.AirflowWebhookUnauthorizedException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.shared.infrastructure.web.WebhookHeaderNames;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = PipelineFailureCallbackController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("PipelineFailureCallbackController")
class PipelineFailureCallbackControllerTest {

  private static final String BASE_URL = "/api/v1/pipeline-jobs/123/callbacks/failures";

  private final MockMvc mockMvc;

  @Autowired
  PipelineFailureCallbackControllerTest(MockMvc mockMvc) {
    this.mockMvc = mockMvc;
  }

  @MockitoBean private ReceivePipelineJobFailureCallbackUseCase useCase;

  @Test
  @DisplayName("유효한 failure callback이면 200을 반환한다")
  @WithMockUser
  void receiveFailureCallback_validRequest_returns200() throws Exception {
    given(useCase.execute(any()))
        .willReturn(
            ReceivePipelineJobFailureCallbackResult.of(
                "PROCESSED", "evt-failure-1", 123L, PipelineJob.STATUS_FAILED));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validFailureRequestJson()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PROCESSED"))
        .andExpect(jsonPath("$.pipelineJobId").value(123))
        .andExpect(jsonPath("$.jobStatus").value("FAILED"));
  }

  @Test
  @DisplayName("시크릿이 잘못되면 401을 반환한다")
  @WithMockUser
  void receiveFailureCallback_invalidSecret_returns401() throws Exception {
    given(useCase.execute(any())).willThrow(new AirflowWebhookUnauthorizedException());

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType("application/json")
                .content(validFailureRequestJson()))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }

  @Test
  @DisplayName("요청 검증 실패면 400을 반환한다")
  @WithMockUser
  void receiveFailureCallback_validationFailure_returns400() throws Exception {
    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content("{\"externalEventId\":\"\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @DisplayName("failure message가 너무 길면 400을 반환한다")
  @WithMockUser
  void receiveFailureCallback_tooLongMessage_returns400() throws Exception {
    String requestJson = validFailureRequestJson().replace("PII masking failed", "a".repeat(5001));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(requestJson))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  private String validFailureRequestJson() {
    return """
        {
          "externalEventId": "evt-failure-1",
          "dagId": "domain_pack_generation",
          "dagRunId": "pipeline_job_123",
          "failedStage": "preprocessing",
          "reason": "TASK_FAILED",
          "message": "PII masking failed",
          "occurredAt": "2026-05-04T10:30:00Z",
          "error": {
            "type": "PipelineStageError",
            "message": "PII masking failed"
          }
        }
        """;
  }
}
