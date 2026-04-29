package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.domainpack.application.DomainPackDetailResult;
import com.init.domainpack.application.DomainPackVersionDetailResult;
import com.init.domainpack.application.GetDomainPackDetailUseCase;
import com.init.domainpack.application.GetDomainPackVersionDetailUseCase;
import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = DomainPackController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("DomainPackController")
class DomainPackControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private GetDomainPackDetailUseCase packDetailUseCase;
  @MockitoBean private GetDomainPackVersionDetailUseCase versionDetailUseCase;

  private static final OffsetDateTime NOW = OffsetDateTime.parse("2025-04-03T10:00:00+09:00");

  @Test
  @DisplayName("GET /{packId} → 200 OK, JSON 구조 검증")
  @WithLongPrincipal(10L)
  void should_200_when_getDomainPack() throws Exception {
    DomainPackDetailResult fixture =
        new DomainPackDetailResult(10L, 1L, "my-pack-key", "CS Support Pack", "고객 지원용", List.of(), NOW, NOW);
    given(
            packDetailUseCase.execute(
                argThat(q -> q.workspaceId().equals(1L) && q.packId().equals(10L))))
        .willReturn(fixture);

    mockMvc
        .perform(get("/api/v1/workspaces/1/domain-packs/10"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.packId").value(10))
        .andExpect(jsonPath("$.workspaceId").value(1))
        .andExpect(jsonPath("$.code").value("my-pack-key"))
        .andExpect(jsonPath("$.name").value("CS Support Pack"))
        .andExpect(jsonPath("$.versions").isArray());
  }

  @Test
  @DisplayName("GET /{packId} pack 미존재 → 404")
  @WithLongPrincipal(10L)
  void should_404_when_packNotFound() throws Exception {
    given(packDetailUseCase.execute(argThat(q -> q.packId().equals(999L))))
        .willThrow(new DomainPackNotFoundException(999L));

    mockMvc
        .perform(get("/api/v1/workspaces/1/domain-packs/999"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET /{packId} workspace 미존재 → 404")
  @WithLongPrincipal(10L)
  void should_404_when_workspaceNotFound() throws Exception {
    given(packDetailUseCase.execute(argThat(q -> q.workspaceId().equals(1L))))
        .willThrow(new DomainPackWorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다."));

    mockMvc
        .perform(get("/api/v1/workspaces/1/domain-packs/10"))
        .andExpect(status().isNotFound());
  }

  @Test
  @DisplayName("GET /{packId} 접근 권한 없음 → 403")
  @WithLongPrincipal(10L)
  void should_403_when_unauthorized() throws Exception {
    given(packDetailUseCase.execute(argThat(q -> q.workspaceId().equals(1L))))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("권한 없음"));

    mockMvc
        .perform(get("/api/v1/workspaces/1/domain-packs/10"))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("GET /{packId} 미인증 → 401")
  void should_401_when_unauthenticated_getDomainPack() throws Exception {
    mockMvc.perform(get("/api/v1/workspaces/1/domain-packs/10")).andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("GET /{packId}/versions/{versionId} → 200 OK, summaryJson string 검증")
  @WithLongPrincipal(10L)
  void should_200_when_getDomainPackVersion() throws Exception {
    DomainPackVersionDetailResult fixture =
        new DomainPackVersionDetailResult(
            1L, 10L, 1, "DRAFT", null, "{}", 5L, 3L, 2L, 1L, 4L, NOW, NOW);
    given(
            versionDetailUseCase.execute(
                argThat(
                    q ->
                        q.workspaceId().equals(1L)
                            && q.packId().equals(10L)
                            && q.versionId().equals(1L))))
        .willReturn(fixture);

    mockMvc
        .perform(get("/api/v1/workspaces/1/domain-packs/10/versions/1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.versionId").value(1))
        .andExpect(jsonPath("$.packId").value(10))
        .andExpect(jsonPath("$.summaryJson").isString())
        .andExpect(jsonPath("$.intentCount").value(5))
        .andExpect(jsonPath("$.slotCount").value(3))
        .andExpect(jsonPath("$.policyCount").value(2))
        .andExpect(jsonPath("$.riskCount").value(1))
        .andExpect(jsonPath("$.workflowCount").value(4));
  }

  @Test
  @DisplayName("GET /{packId}/versions/{versionId} version 미존재 → 404")
  @WithLongPrincipal(10L)
  void should_404_when_versionNotFound() throws Exception {
    given(versionDetailUseCase.execute(argThat(q -> q.versionId().equals(999L))))
        .willThrow(new DomainPackVersionNotFoundException(999L));

    mockMvc
        .perform(get("/api/v1/workspaces/1/domain-packs/10/versions/999"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_VERSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET /{packId}/versions/{versionId} 미인증 → 401")
  void should_401_when_unauthenticated_getDomainPackVersion() throws Exception {
    mockMvc
        .perform(get("/api/v1/workspaces/1/domain-packs/10/versions/1"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("GET /{packId}/versions/{versionId} workspace 미존재 → 404")
  @WithLongPrincipal(10L)
  void should_404_when_versionEndpoint_workspaceNotFound() throws Exception {
    given(versionDetailUseCase.execute(argThat(q -> q.workspaceId().equals(1L))))
        .willThrow(new DomainPackWorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다."));

    mockMvc
        .perform(get("/api/v1/workspaces/1/domain-packs/10/versions/1"))
        .andExpect(status().isNotFound());
  }

  @Test
  @DisplayName("GET /{packId}/versions/{versionId} 접근 권한 없음 → 403")
  @WithLongPrincipal(10L)
  void should_403_when_versionEndpoint_unauthorized() throws Exception {
    given(versionDetailUseCase.execute(argThat(q -> q.workspaceId().equals(1L))))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("권한 없음"));

    mockMvc
        .perform(get("/api/v1/workspaces/1/domain-packs/10/versions/1"))
        .andExpect(status().isForbidden());
  }
}
