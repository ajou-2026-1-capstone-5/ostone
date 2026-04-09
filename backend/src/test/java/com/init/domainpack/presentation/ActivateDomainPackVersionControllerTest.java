package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.domainpack.application.ActivateDomainPackVersionResult;
import com.init.domainpack.application.ActivateDomainPackVersionUseCase;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionConflictException;
import com.init.domainpack.application.exception.DomainPackVersionInvalidStateException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * NI-1 Option B 채택 (corpus 선례): {@link WithLongPrincipal} 어노테이션으로 Long principal을 주입한다.
 *
 * <p>SecurityConfig가 @WebMvcTest 스캔 대상이 아니므로 기본 Spring Security 적용. CSRF 활성화로 모든 POST 요청에 {@code
 * .with(csrf())} 명시.
 */
@WebMvcTest(
    value = ActivateDomainPackVersionController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("ActivateDomainPackVersionController")
class ActivateDomainPackVersionControllerTest {

  @Autowired private MockMvc mockMvc;

  @SuppressWarnings("removal")
  @MockBean
  private ActivateDomainPackVersionUseCase useCase;

  private static final String BASE_URL = "/api/v1/workspaces/1/domain-packs/7/versions/42/activate";

  @Test
  @DisplayName("유효한 version → 200 OK, lifecycleStatus=PUBLISHED")
  @WithLongPrincipal(10L)
  void activate_validVersion_returns200() throws Exception {
    ActivateDomainPackVersionResult result =
        new ActivateDomainPackVersionResult(
            42L,
            7L,
            3,
            "PUBLISHED",
            OffsetDateTime.parse("2026-04-09T12:00:00Z"),
            OffsetDateTime.parse("2026-04-09T12:00:00Z"));
    given(useCase.execute(any())).willReturn(result);

    mockMvc
        .perform(post(BASE_URL).with(csrf()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lifecycleStatus").value("PUBLISHED"))
        .andExpect(jsonPath("$.publishedAt").isNotEmpty())
        .andExpect(jsonPath("$.id").value(42))
        .andExpect(jsonPath("$.domainPackId").value(7));
  }

  @Test
  @DisplayName("존재하지 않는 versionId → 404 DOMAIN_PACK_VERSION_NOT_FOUND")
  @WithLongPrincipal(10L)
  void activate_nonExistentVersion_returns404() throws Exception {
    given(useCase.execute(any())).willThrow(new DomainPackVersionNotFoundException(42L));

    mockMvc
        .perform(post(BASE_URL).with(csrf()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_VERSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("이미 PUBLISHED 상태 → 400 DOMAIN_PACK_INVALID_STATE")
  @WithLongPrincipal(10L)
  void activate_alreadyPublished_returns400() throws Exception {
    given(useCase.execute(any()))
        .willThrow(
            new DomainPackVersionInvalidStateException("Domain pack version is already published"));

    mockMvc
        .perform(post(BASE_URL).with(csrf()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_INVALID_STATE"));
  }

  @Test
  @DisplayName("workspace 없음 → 404 DOMAIN_PACK_WORKSPACE_NOT_FOUND")
  @WithLongPrincipal(10L)
  void activate_workspaceNotFound_returns404() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new DomainPackWorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다. id=1"));

    mockMvc
        .perform(post(BASE_URL).with(csrf()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_WORKSPACE_NOT_FOUND"));
  }

  @Test
  @DisplayName("workspace 비멤버 → 403 FORBIDDEN")
  @WithLongPrincipal(10L)
  void activate_workspaceNonMember_returns403() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("워크스페이스에 접근 권한이 없습니다."));

    mockMvc
        .perform(post(BASE_URL).with(csrf()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("동시 활성화 충돌 → 409 DOMAIN_PACK_CONFLICT")
  @WithLongPrincipal(10L)
  void activate_concurrentConflict_returns409() throws Exception {
    given(useCase.execute(any())).willThrow(new DomainPackVersionConflictException(42L));

    mockMvc
        .perform(post(BASE_URL).with(csrf()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_CONFLICT"));
  }

  @Test
  @DisplayName("인증 없는 요청 → 401")
  void activate_unauthenticated_returns401() throws Exception {
    mockMvc.perform(post(BASE_URL).with(csrf())).andExpect(status().isUnauthorized());
  }
}
