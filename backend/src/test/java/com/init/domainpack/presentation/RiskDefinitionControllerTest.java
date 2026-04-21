package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.domainpack.application.GetRiskDefinitionListUseCase;
import com.init.domainpack.application.GetRiskDefinitionUseCase;
import com.init.domainpack.application.RiskDefinitionResponse;
import com.init.domainpack.application.RiskDefinitionSummary;
import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.RiskDefinitionNotFoundException;
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
    value = RiskDefinitionController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("RiskDefinitionController")
class RiskDefinitionControllerTest {

  private static final String BASE_URL = "/api/v1/workspaces/1/domain-packs/7/versions/101/risks";

  @Autowired private MockMvc mockMvc;

  @MockitoBean private GetRiskDefinitionListUseCase listUseCase;
  @MockitoBean private GetRiskDefinitionUseCase detailUseCase;

  @Test
  @DisplayName("GET .../risks/{riskId} → 200 OK, 전체 필드 반환")
  @WithLongPrincipal(10L)
  void should_returnOkWithAllFields_when_riskExists() throws Exception {
    // given
    given(detailUseCase.execute(any()))
        .willReturn(
            new RiskDefinitionResponse(
                5001L,
                101L,
                "RISK_FRAUD",
                "사기 거래 위험",
                "비정상적인 결제 패턴 감지 시 차단",
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
        .perform(get(BASE_URL + "/5001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(5001))
        .andExpect(jsonPath("$.domainPackVersionId").value(101))
        .andExpect(jsonPath("$.riskCode").value("RISK_FRAUD"))
        .andExpect(jsonPath("$.name").value("사기 거래 위험"))
        .andExpect(jsonPath("$.description").value("비정상적인 결제 패턴 감지 시 차단"))
        .andExpect(jsonPath("$.riskLevel").value("HIGH"))
        .andExpect(jsonPath("$.triggerConditionJson").value("{}"))
        .andExpect(jsonPath("$.handlingActionJson").value("{}"))
        .andExpect(jsonPath("$.evidenceJson").value("[]"))
        .andExpect(jsonPath("$.metaJson").value("{}"))
        .andExpect(jsonPath("$.status").value("ACTIVE"))
        .andExpect(jsonPath("$.createdAt").value("2026-04-10T10:00:00Z"))
        .andExpect(jsonPath("$.updatedAt").value("2026-04-10T10:00:00Z"));
  }

  @Test
  @DisplayName("GET .../risks/{riskId} → 404 미존재")
  @WithLongPrincipal(10L)
  void should_return404_when_riskNotFound() throws Exception {
    // given
    given(detailUseCase.execute(any())).willThrow(new RiskDefinitionNotFoundException(9999L));

    // when & then
    mockMvc
        .perform(get(BASE_URL + "/9999"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("RISK_DEFINITION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET .../risks/{riskId} → 403 권한 없음")
  @WithLongPrincipal(10L)
  void should_return403_when_unauthorized() throws Exception {
    // given
    given(detailUseCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("워크스페이스에 접근 권한이 없습니다."));

    // when & then
    mockMvc
        .perform(get(BASE_URL + "/5001"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("GET .../risks/{riskId} → 401 미인증")
  void should_return401_when_unauthenticated() throws Exception {
    // when & then
    mockMvc.perform(get(BASE_URL + "/5001")).andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("GET .../risks/{riskId} → 404 version 미존재")
  @WithLongPrincipal(10L)
  void should_return404_when_versionNotFound() throws Exception {
    // given
    given(detailUseCase.execute(any())).willThrow(new DomainPackVersionNotFoundException(101L));

    // when & then
    mockMvc
        .perform(get(BASE_URL + "/5001"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_VERSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET .../risks → 200 OK, JSON 필드 미노출 검증")
  @WithLongPrincipal(10L)
  void should_returnOkWithSummaryList_when_validRequest() throws Exception {
    // given
    given(listUseCase.execute(any()))
        .willReturn(
            List.of(
                new RiskDefinitionSummary(
                    5001L,
                    101L,
                    "RISK_FRAUD",
                    "사기 거래 위험",
                    "비정상적인 결제 패턴 감지 시 차단",
                    "HIGH",
                    "ACTIVE",
                    OffsetDateTime.parse("2026-04-10T10:00:00Z"),
                    OffsetDateTime.parse("2026-04-10T10:00:00Z"))));

    // when & then
    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].riskCode").value("RISK_FRAUD"))
        .andExpect(jsonPath("$[0].name").value("사기 거래 위험"))
        .andExpect(jsonPath("$[0].triggerConditionJson").doesNotExist())
        .andExpect(jsonPath("$[0].handlingActionJson").doesNotExist())
        .andExpect(jsonPath("$[0].evidenceJson").doesNotExist())
        .andExpect(jsonPath("$[0].metaJson").doesNotExist());
  }

  @Test
  @DisplayName("GET .../risks → risk 없으면 빈 배열")
  @WithLongPrincipal(10L)
  void should_returnEmptyArray_when_noRisksExist() throws Exception {
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
  @DisplayName("GET .../risks → 403 권한 없음")
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
  @DisplayName("GET .../risks → 401 미인증")
  void should_return401_when_listUnauthenticated() throws Exception {
    // when & then
    mockMvc.perform(get(BASE_URL)).andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("GET .../risks → 404 version 소속 불일치")
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
  @DisplayName("GET .../risks → 404 pack 미존재")
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
