package com.init.pipelinejob.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.fixtures.WithLongPrincipal;
import com.init.pipelinejob.application.TriggerDomainPackGenerationResult;
import com.init.pipelinejob.application.TriggerDomainPackGenerationUseCase;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = DomainPackGenerationTriggerController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("DomainPackGenerationTriggerController")
class DomainPackGenerationTriggerControllerTest {

  private static final String BASE_URL =
      "/api/v1/workspaces/1/datasets/7/pipeline-jobs/domain-pack-generation";

  private final MockMvc mockMvc;

  @Autowired
  DomainPackGenerationTriggerControllerTest(MockMvc mockMvc) {
    this.mockMvc = mockMvc;
  }

  @MockitoBean private TriggerDomainPackGenerationUseCase useCase;

  @Test
  @DisplayName("request body 없이 trigger 성공 시 201을 반환한다")
  @WithLongPrincipal(55L)
  void trigger_success_returns201() throws Exception {
    given(useCase.execute(any()))
        .willReturn(
            new TriggerDomainPackGenerationResult(
                123L,
                1L,
                7L,
                PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION,
                PipelineJob.STATUS_RUNNING,
                "domain_pack_generation",
                "pipeline_job_123",
                OffsetDateTime.parse("2026-05-04T10:00:00Z"),
                OffsetDateTime.parse("2026-05-04T10:00:01Z")));

    mockMvc
        .perform(post(BASE_URL).with(csrf()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.pipelineJobId").value(123))
        .andExpect(jsonPath("$.status").value("RUNNING"))
        .andExpect(jsonPath("$.airflowRunId").value("pipeline_job_123"));
  }

  @Test
  @DisplayName("Airflow trigger 실패 시 502를 반환한다")
  @WithLongPrincipal(55L)
  void trigger_airflowFailure_returns502() throws Exception {
    given(useCase.execute(any())).willThrow(new AirflowTriggerFailedException(123L));

    mockMvc
        .perform(post(BASE_URL).with(csrf()))
        .andExpect(status().isBadGateway())
        .andExpect(jsonPath("$.code").value("AIRFLOW_TRIGGER_FAILED"))
        .andExpect(jsonPath("$.pipelineJobId").value(123))
        .andExpect(jsonPath("$.status").value("FAILED"));
  }

  @Test
  @DisplayName("인증 principal이 없으면 401을 반환한다")
  void trigger_noAuthentication_returns401() throws Exception {
    mockMvc.perform(post(BASE_URL).with(csrf())).andExpect(status().isUnauthorized());
  }
}
