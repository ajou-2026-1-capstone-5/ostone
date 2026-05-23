package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.domainpack.application.DeployDomainPackVersionResult;
import com.init.domainpack.application.DeployDomainPackVersionUseCase;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionConflictException;
import com.init.domainpack.application.exception.DomainPackVersionInvalidStateException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.application.exception.BadRequestException;
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
    value = DeployDomainPackVersionController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("DeployDomainPackVersionController")
class DeployDomainPackVersionControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private DeployDomainPackVersionUseCase useCase;

  private static final String BASE_URL = "/api/v1/workspaces/1/domain-packs/7/versions/42/deploy";

  @Test
  @DisplayName("PUBLISHED version 배포 → 200 OK")
  @WithLongPrincipal(10L)
  void should_200_when_deployPublishedVersion() throws Exception {
    DeployDomainPackVersionResult result =
        new DeployDomainPackVersionResult(
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
        .andExpect(jsonPath("$.id").value(42))
        .andExpect(jsonPath("$.domainPackId").value(7))
        .andExpect(jsonPath("$.lifecycleStatus").value("PUBLISHED"))
        .andExpect(jsonPath("$.publishedAt").isNotEmpty());
  }

  @Test
  @DisplayName("DRAFT version 배포 요청 → 400 DOMAIN_PACK_INVALID_STATE")
  @WithLongPrincipal(10L)
  void should_400_when_versionIsDraft() throws Exception {
    given(useCase.execute(any()))
        .willThrow(
            new DomainPackVersionInvalidStateException("PUBLISHED 상태의 version만 배포할 수 있습니다."));

    mockMvc
        .perform(post(BASE_URL).with(csrf()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_INVALID_STATE"));
  }

  @Test
  @DisplayName("DRAFT intent blocker 존재 → 400 DOMAIN_PACK_VERSION_NOT_DEPLOYABLE")
  @WithLongPrincipal(10L)
  void should_400_when_draftIntentRemains() throws Exception {
    given(useCase.execute(any()))
        .willThrow(
            new BadRequestException(
                "DOMAIN_PACK_VERSION_NOT_DEPLOYABLE",
                "DRAFT 상태의 Intent가 1개 남아 있어 Domain Pack Version을 배포할 수 없습니다."));

    mockMvc
        .perform(post(BASE_URL).with(csrf()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_VERSION_NOT_DEPLOYABLE"));
  }

  @Test
  @DisplayName("version 미존재 → 404 DOMAIN_PACK_VERSION_NOT_FOUND")
  @WithLongPrincipal(10L)
  void should_404_when_versionNotFound() throws Exception {
    given(useCase.execute(any())).willThrow(new DomainPackVersionNotFoundException(42L));

    mockMvc
        .perform(post(BASE_URL).with(csrf()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_VERSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("workspace 없음 → 404 DOMAIN_PACK_WORKSPACE_NOT_FOUND")
  @WithLongPrincipal(10L)
  void should_404_when_workspaceMissing() throws Exception {
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
  void should_403_when_notMember() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("워크스페이스에 접근 권한이 없습니다."));

    mockMvc
        .perform(post(BASE_URL).with(csrf()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("동시 배포 충돌 → 409 DOMAIN_PACK_CONFLICT")
  @WithLongPrincipal(10L)
  void should_409_when_conflict() throws Exception {
    given(useCase.execute(any())).willThrow(new DomainPackVersionConflictException(42L));

    mockMvc
        .perform(post(BASE_URL).with(csrf()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_CONFLICT"));
  }

  @Test
  @DisplayName("인증 없는 요청 → 401")
  void should_401_when_unauthenticated() throws Exception {
    mockMvc.perform(post(BASE_URL).with(csrf())).andExpect(status().isUnauthorized());
  }
}
