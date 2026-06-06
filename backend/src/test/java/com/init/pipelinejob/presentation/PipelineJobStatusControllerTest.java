package com.init.pipelinejob.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.auth.application.JwtService;
import com.init.pipelinejob.application.GetLatestPipelineJobQuery;
import com.init.pipelinejob.application.GetLatestPipelineJobResult;
import com.init.pipelinejob.application.GetLatestPipelineJobUseCase;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.shared.infrastructure.security.ApiAuthenticationEntryPoint;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.shared.infrastructure.security.SecurityConfig;
import com.init.shared.presentation.GlobalExceptionHandler;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.time.OffsetDateTime;
import java.util.Date;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(PipelineJobStatusController.class)
@Import({
  SecurityConfig.class,
  JwtAuthenticationFilter.class,
  ApiAuthenticationEntryPoint.class,
  GlobalExceptionHandler.class
})
@TestPropertySource(properties = "cors.allowed-origins=http://localhost:5173")
@DisplayName("PipelineJobStatusController")
class PipelineJobStatusControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private GetLatestPipelineJobUseCase getLatestPipelineJobUseCase;
  @MockitoBean private JwtService jwtService;

  @Test
  @DisplayName("GET latest: workspace 인증 사용자는 최신 job을 조회한다")
  void getLatest_authenticated_returnsLatestJob() throws Exception {
    givenBearerToken("operator-token", "OPERATOR");
    given(getLatestPipelineJobUseCase.execute(any()))
        .willReturn(
            Optional.of(
                new GetLatestPipelineJobResult(
                    77L,
                    2L,
                    15L,
                    null,
                    PipelineJob.JOB_TYPE_INGESTION,
                    PipelineJob.STATUS_RUNNING,
                    "domain_pack_generation",
                    "pipeline_job_77",
                    OffsetDateTime.parse("2026-06-05T01:00:00Z"),
                    OffsetDateTime.parse("2026-06-05T01:00:05Z"),
                    null,
                    120L,
                    null)));

    mockMvc
        .perform(
            get("/api/v1/workspaces/2/datasets/15/pipeline-jobs/latest")
                .header("Authorization", "Bearer operator-token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.pipelineJob.pipelineJobId").value(77))
        .andExpect(jsonPath("$.pipelineJob.workspaceId").value(2))
        .andExpect(jsonPath("$.pipelineJob.datasetId").value(15))
        .andExpect(jsonPath("$.pipelineJob.domainPackId").doesNotExist())
        .andExpect(jsonPath("$.pipelineJob.jobType").value("INGESTION"))
        .andExpect(jsonPath("$.pipelineJob.status").value("RUNNING"))
        .andExpect(jsonPath("$.pipelineJob.airflowDagId").value("domain_pack_generation"))
        .andExpect(jsonPath("$.pipelineJob.airflowRunId").value("pipeline_job_77"))
        .andExpect(jsonPath("$.pipelineJob.requestedAt").exists())
        .andExpect(jsonPath("$.pipelineJob.startedAt").exists())
        .andExpect(jsonPath("$.pipelineJob.finishedAt").doesNotExist())
        .andExpect(jsonPath("$.pipelineJob.runningDurationSeconds").value(120))
        .andExpect(jsonPath("$.pipelineJob.lastErrorMessage").doesNotExist());

    ArgumentCaptor<GetLatestPipelineJobQuery> queryCaptor =
        ArgumentCaptor.forClass(GetLatestPipelineJobQuery.class);
    verify(getLatestPipelineJobUseCase).execute(queryCaptor.capture());
    GetLatestPipelineJobQuery query = queryCaptor.getValue();
    assertThat(query.workspaceId()).isEqualTo(2L);
    assertThat(query.datasetId()).isEqualTo(15L);
    assertThat(query.jobType()).isEqualTo(PipelineJob.JOB_TYPE_INGESTION);
    assertThat(query.userId()).isEqualTo(9L);
  }

  @Test
  @DisplayName("GET latest: job이 없으면 null을 반환한다")
  void getLatest_noJob_returnsNullJob() throws Exception {
    givenBearerToken("operator-token", "OPERATOR");
    given(getLatestPipelineJobUseCase.execute(any())).willReturn(Optional.empty());

    mockMvc
        .perform(
            get("/api/v1/workspaces/2/datasets/15/pipeline-jobs/latest")
                .header("Authorization", "Bearer operator-token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.pipelineJob").doesNotExist());
  }

  private void givenBearerToken(String token, String role) {
    Claims claims =
        Jwts.claims()
            .subject("9")
            .add("type", "access")
            .add("role", role)
            .expiration(new Date(System.currentTimeMillis() + 60_000))
            .build();
    given(jwtService.parseClaims(token)).willReturn(claims);
    given(jwtService.isTokenValid(claims)).willReturn(true);
    given(jwtService.isAccessToken(claims)).willReturn(true);
  }
}
