package com.init.pipelinejob.presentation;

import static com.init.fixtures.JwtClaimsFixtures.accessClaims;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.auth.application.JwtService;
import com.init.pipelinejob.application.AdminPipelineJobListResult;
import com.init.pipelinejob.application.GetAdminPipelineJobListUseCase;
import com.init.pipelinejob.application.RetryAdminPipelineJobResult;
import com.init.pipelinejob.application.RetryAdminPipelineJobUseCase;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.shared.infrastructure.security.ApiAuthenticationEntryPoint;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.shared.infrastructure.security.SecurityConfig;
import com.init.shared.presentation.GlobalExceptionHandler;
import io.jsonwebtoken.Claims;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AdminPipelineJobController.class)
@Import({
  SecurityConfig.class,
  JwtAuthenticationFilter.class,
  ApiAuthenticationEntryPoint.class,
  GlobalExceptionHandler.class
})
@TestPropertySource(properties = "cors.allowed-origins=http://localhost:5173")
@DisplayName("AdminPipelineJobController")
class AdminPipelineJobControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private GetAdminPipelineJobListUseCase getAdminPipelineJobListUseCase;
  @MockitoBean private RetryAdminPipelineJobUseCase retryAdminPipelineJobUseCase;
  @MockitoBean private JwtService jwtService;

  @Test
  @DisplayName("GET /api/v1/admin/pipeline-jobs: SUPER_ADMIN JWT -> 200 OK")
  void list_superAdmin_returns200() throws Exception {
    givenBearerToken("super-admin-token", "SUPER_ADMIN");
    given(getAdminPipelineJobListUseCase.execute(any()))
        .willReturn(
            new AdminPipelineJobListResult(
                List.of(
                    new AdminPipelineJobListResult.Item(
                        11L,
                        1L,
                        7L,
                        null,
                        PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION,
                        PipelineJob.STATUS_FAILED,
                        "domain_pack_generation",
                        "pipeline_job_11",
                        OffsetDateTime.parse("2026-06-03T01:00:00Z"),
                        OffsetDateTime.parse("2026-06-03T01:02:00Z"),
                        OffsetDateTime.parse("2026-06-03T01:05:00Z"),
                        120L,
                        null,
                        300L,
                        true,
                        "failed",
                        null,
                        12L)),
                0,
                20,
                1,
                1));

    mockMvc
        .perform(
            get("/api/v1/admin/pipeline-jobs")
                .header("Authorization", "Bearer super-admin-token")
                .param("status", "FAILED")
                .param("workspaceId", "1")
                .param("dagId", "domain")
                .param("runId", "pipeline_job"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].pipelineJobId").value(11))
        .andExpect(jsonPath("$.items[0].queueLagSeconds").value(120))
        .andExpect(jsonPath("$.items[0].lagExceeded").value(true))
        .andExpect(jsonPath("$.items[0].retryPipelineJobId").value(12));
  }

  @Test
  @DisplayName("POST /api/v1/admin/pipeline-jobs/{id}/retry: SUPER_ADMIN JWT -> 201 Created")
  void retry_superAdmin_returns201() throws Exception {
    givenBearerToken("super-admin-token", "SUPER_ADMIN");
    given(retryAdminPipelineJobUseCase.execute(eq(11L), eq(1L)))
        .willReturn(
            new RetryAdminPipelineJobResult(
                11L,
                12L,
                1L,
                7L,
                PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION,
                PipelineJob.STATUS_RUNNING,
                "domain_pack_generation",
                "pipeline_job_12",
                OffsetDateTime.parse("2026-06-03T02:00:00Z"),
                OffsetDateTime.parse("2026-06-03T02:00:01Z")));

    mockMvc
        .perform(
            post("/api/v1/admin/pipeline-jobs/11/retry")
                .header("Authorization", "Bearer super-admin-token"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.sourcePipelineJobId").value(11))
        .andExpect(jsonPath("$.retryPipelineJobId").value(12))
        .andExpect(jsonPath("$.airflowRunId").value("pipeline_job_12"));
  }

  @Test
  @DisplayName("GET /api/v1/admin/pipeline-jobs: OPERATOR JWT -> 403 Forbidden")
  void list_operator_returns403() throws Exception {
    givenBearerToken("operator-token", "OPERATOR");

    mockMvc
        .perform(
            get("/api/v1/admin/pipeline-jobs").header("Authorization", "Bearer operator-token"))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("POST /api/v1/admin/pipeline-jobs/{id}/retry: ADMIN JWT -> 403 Forbidden")
  void retry_workspaceAdmin_returns403() throws Exception {
    givenBearerToken("workspace-admin-token", "ADMIN");

    mockMvc
        .perform(
            post("/api/v1/admin/pipeline-jobs/11/retry")
                .header("Authorization", "Bearer workspace-admin-token"))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("GET /api/v1/admin/pipeline-jobs: JWT 없음 -> 401 Unauthorized")
  void list_noToken_returns401() throws Exception {
    mockMvc.perform(get("/api/v1/admin/pipeline-jobs")).andExpect(status().isUnauthorized());
  }

  private void givenBearerToken(String token, String role) {
    Claims claims = accessClaims("1", role);
    given(jwtService.parseClaims(token)).willReturn(claims);
    given(jwtService.isTokenValid(claims)).willReturn(true);
    given(jwtService.isAccessToken(claims)).willReturn(true);
  }
}
