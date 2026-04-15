package com.init.pipelinejob.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.pipelinejob.application.ReceiveDomainPackDraftCallbackResult;
import com.init.pipelinejob.application.ReceiveDomainPackDraftCallbackUseCase;
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
@DisplayName("PipelineIntentDraftCallbackController — Domain Pack Drafts")
class PipelineDomainPackDraftCallbackControllerTest {

  private static final String BASE_URL = "/api/v1/pipeline-jobs/11/callbacks/domain-pack-drafts";

  @Autowired private MockMvc mockMvc;

  @MockitoBean private ReceiveDomainPackDraftCallbackUseCase domainPackUseCase;
  @MockitoBean private ReceiveIntentDraftCallbackUseCase intentUseCase;

  @Test
  @DisplayName("유효한 DomainPack Draft 요청이면 201을 반환한다")
  @WithMockUser
  void receiveDomainPackDraftCallback_validRequest_returns201() throws Exception {
    given(domainPackUseCase.execute(any()))
        .willReturn(
            ReceiveDomainPackDraftCallbackResult.created(
                "evt-draft-1", 7L, 101L, 3, "refund-pack", true, 11L));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validDomainPackRequestJson()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("CREATED"))
        .andExpect(jsonPath("$.domainPackId").value(7))
        .andExpect(jsonPath("$.domainPackVersionId").value(101))
        .andExpect(jsonPath("$.versionNo").value(3))
        .andExpect(jsonPath("$.packKey").value("refund-pack"))
        .andExpect(jsonPath("$.createdPack").value(true));
  }

  @Test
  @DisplayName("중복 callback이면 200을 반환한다")
  @WithMockUser
  void receiveDomainPackDraftCallback_duplicate_returns200() throws Exception {
    given(domainPackUseCase.execute(any()))
        .willReturn(ReceiveDomainPackDraftCallbackResult.duplicateIgnored("evt-draft-1"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validDomainPackRequestJson()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("DUPLICATE_IGNORED"));
  }

  @Test
  @DisplayName("시크릿이 잘못되면 401을 반환한다")
  @WithMockUser
  void receiveDomainPackDraftCallback_invalidSecret_returns401() throws Exception {
    given(domainPackUseCase.execute(any())).willThrow(new AirflowWebhookUnauthorizedException());

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "wrong-secret")
                .contentType("application/json")
                .content(validDomainPackRequestJson()))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }

  @Test
  @DisplayName("job이 없으면 404를 반환한다")
  @WithMockUser
  void receiveDomainPackDraftCallback_jobNotFound_returns404() throws Exception {
    given(domainPackUseCase.execute(any())).willThrow(new PipelineJobNotFoundException(11L));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validDomainPackRequestJson()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("PIPELINE_JOB_NOT_FOUND"));
  }

  @Test
  @DisplayName("이미 종료된 job이면 409를 반환한다")
  @WithMockUser
  void receiveDomainPackDraftCallback_finalizedJob_returns409() throws Exception {
    given(domainPackUseCase.execute(any()))
        .willThrow(new PipelineJobAlreadyFinalizedException(11L));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validDomainPackRequestJson()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("PIPELINE_JOB_ALREADY_FINALIZED"));
  }

  @Test
  @DisplayName("요청 검증 실패면 400을 반환한다")
  @WithMockUser
  void receiveDomainPackDraftCallback_validationFailure_returns400() throws Exception {
    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content("{\"externalEventId\":\"\",\"packKey\":\"\",\"packName\":\"\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  private String validDomainPackRequestJson() {
    return """
        {
          "externalEventId": "evt-draft-1",
          "packKey": "refund-pack",
          "packName": "환불 Pack",
          "summaryJson": "{\\"clusterCount\\":12}"
        }
        """;
  }
}
