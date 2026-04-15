package com.init.pipelinejob.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.pipelinejob.application.ReceiveDomainPackDraftCallbackUseCase;
import com.init.pipelinejob.application.ReceiveIntentDraftCallbackResult;
import com.init.pipelinejob.application.ReceiveIntentDraftCallbackUseCase;
import com.init.pipelinejob.application.exception.AirflowWebhookUnauthorizedException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyFinalizedException;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
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
    value = PipelineIntentDraftCallbackController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("PipelineIntentDraftCallbackController — Intent Drafts")
class PipelineIntentDraftCallbackControllerTest {

  private static final String BASE_URL = "/api/v1/pipeline-jobs/11/callbacks/intent-drafts";

  @Autowired private MockMvc mockMvc;

  @MockitoBean private ReceiveIntentDraftCallbackUseCase intentUseCase;
  @MockitoBean private ReceiveDomainPackDraftCallbackUseCase domainPackUseCase;

  @Test
  @DisplayName("유효한 intent 추가 요청이면 201을 반환한다")
  @WithMockUser
  void receiveIntentDraftCallback_validRequest_returns201() throws Exception {
    given(intentUseCase.execute(any()))
        .willReturn(ReceiveIntentDraftCallbackResult.created("evt-1", 101L, 2, 0, 5, 11L));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validIntentRequestJson()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("CREATED"))
        .andExpect(jsonPath("$.domainPackVersionId").value(101))
        .andExpect(jsonPath("$.addedIntentCount").value(2))
        .andExpect(jsonPath("$.totalIntentCount").value(5));
  }

  @Test
  @DisplayName("중복 callback이면 200을 반환한다")
  @WithMockUser
  void receiveIntentDraftCallback_duplicate_returns200() throws Exception {
    given(intentUseCase.execute(any()))
        .willReturn(ReceiveIntentDraftCallbackResult.duplicateIgnored("evt-1"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validIntentRequestJson()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("DUPLICATE_IGNORED"));
  }

  @Test
  @DisplayName("시크릿이 잘못되면 401을 반환한다")
  @WithMockUser
  void receiveIntentDraftCallback_invalidSecret_returns401() throws Exception {
    given(intentUseCase.execute(any())).willThrow(new AirflowWebhookUnauthorizedException());

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "wrong-secret")
                .contentType("application/json")
                .content(validIntentRequestJson()))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }

  @Test
  @DisplayName("job이 없으면 404를 반환한다")
  @WithMockUser
  void receiveIntentDraftCallback_jobNotFound_returns404() throws Exception {
    given(intentUseCase.execute(any())).willThrow(new PipelineJobNotFoundException(11L));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validIntentRequestJson()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("PIPELINE_JOB_NOT_FOUND"));
  }

  @Test
  @DisplayName("이미 종료된 job이면 409를 반환한다")
  @WithMockUser
  void receiveIntentDraftCallback_finalizedJob_returns409() throws Exception {
    given(intentUseCase.execute(any())).willThrow(new PipelineJobAlreadyFinalizedException(11L));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validIntentRequestJson()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("PIPELINE_JOB_ALREADY_FINALIZED"));
  }

  @Test
  @DisplayName("요청 검증 실패면 400을 반환한다")
  @WithMockUser
  void receiveIntentDraftCallback_validationFailure_returns400() throws Exception {
    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content("{\"externalEventId\":\"\",\"domainPackVersionId\":null,\"intents\":[]}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  private String validIntentRequestJson() {
    return """
        {
          "externalEventId": "evt-intent-1",
          "domainPackVersionId": 101,
          "intents": [
            {
              "intentCode": "refund_request",
              "name": "환불 요청",
              "taxonomyLevel": 1
            },
            {
              "intentCode": "refund_request_cancel",
              "name": "환불 요청 취소",
              "taxonomyLevel": 2,
              "parentIntentCode": "refund_request"
            }
          ]
        }
        """;
  }
}
