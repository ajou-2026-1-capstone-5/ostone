package com.init.workspace.presentation;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workspace.application.GetWorkspaceDashboardActionRecommendationsCommand;
import com.init.workspace.application.GetWorkspaceDashboardActionRecommendationsUseCase;
import com.init.workspace.application.GetWorkspaceDashboardHealthUseCase;
import com.init.workspace.application.WorkspaceDashboardActionRecommendationResult;
import com.init.workspace.application.WorkspaceDashboardActionRecommendationsResult;
import com.init.workspace.application.WorkspaceDashboardGenerationResult;
import com.init.workspace.application.WorkspaceDashboardHealthResult;
import com.init.workspace.application.WorkspaceDashboardKnowledgePackResult;
import com.init.workspace.application.WorkspaceDashboardLogUploadResult;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = WorkspaceDashboardController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("WorkspaceDashboardController")
class WorkspaceDashboardControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private GetWorkspaceDashboardHealthUseCase getWorkspaceDashboardHealthUseCase;

  @MockitoBean
  private GetWorkspaceDashboardActionRecommendationsUseCase
      getWorkspaceDashboardActionRecommendationsUseCase;

  @Test
  @DisplayName("GET 운영 지식팩 건강도 → 200 OK")
  void should_200반환_when_운영지식팩건강도조회() throws Exception {
    given(getWorkspaceDashboardHealthUseCase.execute(1L, 7L)).willReturn(healthResult());

    mockMvc
        .perform(get("/api/v1/workspaces/1/dashboard/knowledge-pack-health").principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.activeKnowledgePack.versionNo").value(4))
        .andExpect(jsonPath("$.lastLogUpload.datasetName").value("6월 상담 로그"))
        .andExpect(jsonPath("$.lastKnowledgePackGeneration.status").value("SUCCEEDED"))
        .andExpect(jsonPath("$.pendingReviewCount").value(2));
  }

  @Test
  @DisplayName("GET 고객 액션 추천 → 200 OK")
  void should_200반환_when_고객액션추천조회() throws Exception {
    given(
            getWorkspaceDashboardActionRecommendationsUseCase.execute(
                new GetWorkspaceDashboardActionRecommendationsCommand(
                    1L,
                    7L,
                    java.time.LocalDate.parse("2026-05-29"),
                    java.time.LocalDate.parse("2026-06-04"))))
        .willReturn(recommendationsResult());

    mockMvc
        .perform(
            get("/api/v1/workspaces/1/dashboard/action-recommendations")
                .queryParam("from", "2026-05-29")
                .queryParam("to", "2026-06-04")
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.recommendations[0].ruleCode").value("HOTPATH_SURGE"))
        .andExpect(jsonPath("$.recommendations[0].sourceLabel").value("운영 지표 기반"))
        .andExpect(jsonPath("$.recommendations[0].evidenceValue").value("+33.3%"))
        .andExpect(jsonPath("$.recommendations[0].targetPath").value("/workspaces/1/workflows"));
  }

  private WorkspaceDashboardHealthResult healthResult() {
    OffsetDateTime now = OffsetDateTime.parse("2026-06-03T10:00:00Z");
    return new WorkspaceDashboardHealthResult(
        new WorkspaceDashboardKnowledgePackResult(11L, "CS Pack", 12L, 4, now, now, 77L),
        new WorkspaceDashboardLogUploadResult(8L, "june-log", "6월 상담 로그", "READY", now),
        new WorkspaceDashboardGenerationResult(77L, 8L, 11L, "SUCCEEDED", now, now, now, null),
        2L);
  }

  private WorkspaceDashboardActionRecommendationsResult recommendationsResult() {
    OffsetDateTime now = OffsetDateTime.parse("2026-06-03T10:00:00Z");
    return new WorkspaceDashboardActionRecommendationsResult(
        1L,
        now,
        now.plusDays(1),
        List.of(
            new WorkspaceDashboardActionRecommendationResult(
                "HOTPATH_SURGE",
                85,
                "운영 지표 기반",
                "workflow 점검",
                "선택 기간 실행량이 전 기간보다 크게 증가했습니다.",
                "전 기간 대비",
                "+33.3%",
                "/workspaces/1/workflows")));
  }

  private UsernamePasswordAuthenticationToken auth() {
    return new UsernamePasswordAuthenticationToken(
        7L, null, java.util.List.of(new SimpleGrantedAuthority("ROLE_USER")));
  }
}
