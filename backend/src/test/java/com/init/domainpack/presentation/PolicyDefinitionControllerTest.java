package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.domainpack.application.GetPolicyDefinitionListUseCase;
import com.init.domainpack.application.GetPolicyDefinitionUseCase;
import com.init.domainpack.application.PolicyDefinitionResponse;
import com.init.domainpack.application.PolicyDefinitionSummary;
import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.PolicyDefinitionNotFoundException;
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
    value = PolicyDefinitionController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("PolicyDefinitionController")
class PolicyDefinitionControllerTest {

  private static final String BASE_URL =
      "/api/v1/workspaces/1/domain-packs/7/versions/101/policies";

  @Autowired private MockMvc mockMvc;

  @MockitoBean private GetPolicyDefinitionListUseCase listUseCase;
  @MockitoBean private GetPolicyDefinitionUseCase detailUseCase;

  @Test
  @DisplayName("GET .../policies/{policyId} → 200 OK, 전체 필드 반환")
  @WithLongPrincipal(10L)
  void should_returnOkWithAllFields_when_policyExists() throws Exception {
    // given
    given(detailUseCase.execute(any()))
        .willReturn(
            new PolicyDefinitionResponse(
                3001L,
                101L,
                "POL_RETURN",
                "반품 처리 정책",
                "7일 이내 반품 허용",
                "HIGH",
                "{}",
                "{}",
                "[]",
                "{}",
                "ACTIVE",
                OffsetDateTime.parse("2026-04-10T10:00:00Z"),
                OffsetDateTime.parse("2026-04-10T10:00:00Z")));

    // when & then
    mockMvc
        .perform(get(BASE_URL + "/3001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(3001))
        .andExpect(jsonPath("$.domainPackVersionId").value(101))
        .andExpect(jsonPath("$.policyCode").value("POL_RETURN"))
        .andExpect(jsonPath("$.name").value("반품 처리 정책"))
        .andExpect(jsonPath("$.description").value("7일 이내 반품 허용"))
        .andExpect(jsonPath("$.severity").value("HIGH"))
        .andExpect(jsonPath("$.conditionJson").value("{}"))
        .andExpect(jsonPath("$.actionJson").value("{}"))
        .andExpect(jsonPath("$.evidenceJson").value("[]"))
        .andExpect(jsonPath("$.metaJson").value("{}"))
        .andExpect(jsonPath("$.status").value("ACTIVE"))
        .andExpect(jsonPath("$.createdAt").value("2026-04-10T10:00:00Z"))
        .andExpect(jsonPath("$.updatedAt").value("2026-04-10T10:00:00Z"));
  }

  @Test
  @DisplayName("GET .../policies/{policyId} → 404 미존재")
  @WithLongPrincipal(10L)
  void should_return404_when_policyNotFound() throws Exception {
    // given
    given(detailUseCase.execute(any())).willThrow(new PolicyDefinitionNotFoundException(9999L));

    // when & then
    mockMvc
        .perform(get(BASE_URL + "/9999"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("POLICY_DEFINITION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET .../policies/{policyId} → 403 권한 없음")
  @WithLongPrincipal(10L)
  void should_return403_when_unauthorized() throws Exception {
    // given
    given(detailUseCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("워크스페이스에 접근 권한이 없습니다."));

    // when & then
    mockMvc
        .perform(get(BASE_URL + "/3001"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("GET .../policies/{policyId} → 401 미인증")
  void should_return401_when_unauthenticated() throws Exception {
    // when & then
    mockMvc.perform(get(BASE_URL + "/3001")).andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("GET .../policies/{policyId} → 404 version 미존재")
  @WithLongPrincipal(10L)
  void should_return404_when_versionNotFound() throws Exception {
    // given
    given(detailUseCase.execute(any())).willThrow(new DomainPackVersionNotFoundException(101L));

    // when & then
    mockMvc
        .perform(get(BASE_URL + "/3001"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_VERSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET .../policies → 200 OK, JSON 필드 미노출 검증")
  @WithLongPrincipal(10L)
  void should_returnOkWithSummaryList_when_validRequest() throws Exception {
    // given
    given(listUseCase.execute(any()))
        .willReturn(
            List.of(
                new PolicyDefinitionSummary(
                    3001L,
                    101L,
                    "POL_RETURN",
                    "반품 처리 정책",
                    "7일 이내 반품 허용",
                    "HIGH",
                    "ACTIVE",
                    OffsetDateTime.parse("2026-04-10T10:00:00Z"),
                    OffsetDateTime.parse("2026-04-10T10:00:00Z"))));

    // when & then
    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].policyCode").value("POL_RETURN"))
        .andExpect(jsonPath("$[0].name").value("반품 처리 정책"))
        .andExpect(jsonPath("$[0].conditionJson").doesNotExist())
        .andExpect(jsonPath("$[0].actionJson").doesNotExist())
        .andExpect(jsonPath("$[0].evidenceJson").doesNotExist())
        .andExpect(jsonPath("$[0].metaJson").doesNotExist());
  }

  @Test
  @DisplayName("GET .../policies → policy 없으면 빈 배열")
  @WithLongPrincipal(10L)
  void should_returnEmptyArray_when_noPoliciesExist() throws Exception {
    // given
    given(listUseCase.execute(any())).willReturn(List.of());

    // when & then
    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray())
        .andExpect(jsonPath("$").isEmpty());
  }

  @Test
  @DisplayName("GET .../policies → 403 권한 없음")
  @WithLongPrincipal(10L)
  void should_return403_when_listUnauthorized() throws Exception {
    // given
    given(listUseCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("워크스페이스에 접근 권한이 없습니다."));

    // when & then
    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("GET .../policies → 401 미인증")
  void should_return401_when_listUnauthenticated() throws Exception {
    // when & then
    mockMvc.perform(get(BASE_URL)).andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("GET .../policies → 404 version 소속 불일치")
  @WithLongPrincipal(10L)
  void should_return404_when_listVersionNotFound() throws Exception {
    // given
    given(listUseCase.execute(any())).willThrow(new DomainPackVersionNotFoundException(101L));

    // when & then
    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_VERSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET .../policies → 404 pack 미존재")
  @WithLongPrincipal(10L)
  void should_return404_when_listPackNotFound() throws Exception {
    // given
    given(listUseCase.execute(any())).willThrow(new DomainPackNotFoundException(7L));

    // when & then
    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_NOT_FOUND"));
  }
}
