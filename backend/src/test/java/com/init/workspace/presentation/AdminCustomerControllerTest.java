package com.init.workspace.presentation;

import static com.init.fixtures.JwtClaimsFixtures.accessClaims;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.auth.application.JwtService;
import com.init.shared.infrastructure.security.ApiAuthenticationEntryPoint;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.shared.infrastructure.security.SecurityConfig;
import com.init.shared.presentation.GlobalExceptionHandler;
import com.init.workspace.application.AdminCustomerBillingSummaryResult;
import com.init.workspace.application.AdminCustomerDetailResult;
import com.init.workspace.application.AdminCustomerMemberSummaryResult;
import com.init.workspace.application.AdminCustomerPipelineJobResult;
import com.init.workspace.application.AdminCustomerPipelineSummaryResult;
import com.init.workspace.application.AdminCustomerSliceResult;
import com.init.workspace.application.AdminCustomerSummaryResult;
import com.init.workspace.application.AdminCustomerUploadSummaryResult;
import com.init.workspace.application.AdminCustomerWorkspaceResult;
import com.init.workspace.application.GetAdminCustomerDetailUseCase;
import com.init.workspace.application.GetAdminCustomerListUseCase;
import com.init.workspace.application.WorkspaceFreeOnboardingResult;
import com.init.workspace.application.WorkspaceFreeOnboardingService;
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

@WebMvcTest(AdminCustomerController.class)
@Import({
  SecurityConfig.class,
  JwtAuthenticationFilter.class,
  ApiAuthenticationEntryPoint.class,
  GlobalExceptionHandler.class
})
@TestPropertySource(properties = "cors.allowed-origins=http://localhost:5173")
@DisplayName("AdminCustomerController")
class AdminCustomerControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private GetAdminCustomerListUseCase getAdminCustomerListUseCase;
  @MockitoBean private GetAdminCustomerDetailUseCase getAdminCustomerDetailUseCase;
  @MockitoBean private WorkspaceFreeOnboardingService freeOnboardingService;
  @MockitoBean private JwtService jwtService;

  @Test
  @DisplayName("GET /api/v1/admin/customers: SUPER_ADMIN JWT → 고객사 slice 반환")
  void should_고객사Slice반환_when_SUPER_ADMIN요청() throws Exception {
    givenSuperAdminBearerToken("super-admin-token");
    given(getAdminCustomerListUseCase.execute(eq("acme"), eq("ACTIVE"), eq(0), eq(20)))
        .willReturn(new AdminCustomerSliceResult(List.of(summary()), 0, 20, false));

    mockMvc
        .perform(
            get("/api/v1/admin/customers?q=acme&status=ACTIVE&page=0&size=20")
                .header("Authorization", "Bearer super-admin-token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].workspace.id").value(1))
        .andExpect(jsonPath("$.content[0].workspace.workspaceKey").value("acme"))
        .andExpect(jsonPath("$.content[0].memberCount").value(3))
        .andExpect(jsonPath("$.content[0].latestUpload.datasetKey").value("upload-1"))
        .andExpect(jsonPath("$.content[0].latestPipelineJob.status").value("SUCCEEDED"))
        .andExpect(jsonPath("$.hasNext").value(false));
  }

  @Test
  @DisplayName("GET /api/v1/admin/customers: OPERATOR JWT → 403 Forbidden")
  void should_403반환_when_OPERATOR요청() throws Exception {
    givenBearerToken("operator-token", "OPERATOR");

    mockMvc
        .perform(get("/api/v1/admin/customers").header("Authorization", "Bearer operator-token"))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("GET /api/v1/admin/customers: ADMIN JWT → 403 Forbidden")
  void should_403반환_when_ADMIN요청() throws Exception {
    givenBearerToken("admin-token", "ADMIN");

    mockMvc
        .perform(get("/api/v1/admin/customers").header("Authorization", "Bearer admin-token"))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("GET /api/v1/admin/customers/{workspaceId}: SUPER_ADMIN JWT → 상세 반환")
  void should_고객사상세반환_when_SUPER_ADMIN요청() throws Exception {
    givenSuperAdminBearerToken("super-admin-token");
    given(getAdminCustomerDetailUseCase.execute(1L))
        .willReturn(
            new AdminCustomerDetailResult(
                workspace(),
                new AdminCustomerMemberSummaryResult(3, 1, 1, 0, 1, List.of()),
                AdminCustomerBillingSummaryResult.unavailable(),
                upload(),
                new AdminCustomerPipelineSummaryResult(
                    2, 0, 1, 1, pipelineJob(), List.of(pipelineJob()))));

    mockMvc
        .perform(
            get("/api/v1/admin/customers/1").header("Authorization", "Bearer super-admin-token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.workspace.workspaceKey").value("acme"))
        .andExpect(jsonPath("$.members.totalCount").value(3))
        .andExpect(jsonPath("$.billing.subscriptionStatus").doesNotExist())
        .andExpect(jsonPath("$.pipeline.totalCount").value(2));
  }

  @Test
  @DisplayName(
      "POST /api/v1/admin/customers/{workspaceId}/free-onboarding/restore: SUPER_ADMIN JWT → 복구")
  void should_무료온보딩복구_when_SUPER_ADMIN요청() throws Exception {
    givenSuperAdminBearerToken("super-admin-token");
    given(freeOnboardingService.restore(1L))
        .willReturn(new WorkspaceFreeOnboardingResult(1L, "AVAILABLE", null, null, null, null));

    mockMvc
        .perform(
            post("/api/v1/admin/customers/1/free-onboarding/restore")
                .header("Authorization", "Bearer super-admin-token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.workspaceId").value(1))
        .andExpect(jsonPath("$.status").value("AVAILABLE"))
        .andExpect(jsonPath("$.datasetId").doesNotExist());
  }

  private AdminCustomerSummaryResult summary() {
    return new AdminCustomerSummaryResult(
        workspace(), 3, AdminCustomerBillingSummaryResult.unavailable(), upload(), pipelineJob());
  }

  private AdminCustomerWorkspaceResult workspace() {
    return new AdminCustomerWorkspaceResult(
        1L,
        "acme",
        "Acme",
        "고객사",
        "ACTIVE",
        OffsetDateTime.parse("2026-06-01T00:00:00Z"),
        OffsetDateTime.parse("2026-06-02T00:00:00Z"));
  }

  private AdminCustomerUploadSummaryResult upload() {
    return new AdminCustomerUploadSummaryResult(
        10L, "upload-1", "상담 로그", "READY", OffsetDateTime.parse("2026-06-02T01:00:00Z"));
  }

  private AdminCustomerPipelineJobResult pipelineJob() {
    return new AdminCustomerPipelineJobResult(
        20L,
        "DOMAIN_PACK_GENERATION",
        "SUCCEEDED",
        OffsetDateTime.parse("2026-06-02T02:00:00Z"),
        OffsetDateTime.parse("2026-06-02T02:01:00Z"),
        OffsetDateTime.parse("2026-06-02T02:05:00Z"));
  }

  private void givenSuperAdminBearerToken(String token) {
    givenBearerToken(token, "SUPER_ADMIN");
  }

  private void givenBearerToken(String token, String role) {
    Claims claims = accessClaims("1", role);
    given(jwtService.parseClaims(token)).willReturn(claims);
    given(jwtService.isTokenValid(claims)).willReturn(true);
    given(jwtService.isAccessToken(claims)).willReturn(true);
  }
}
