package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.RiskDefinitionResponse;
import com.init.domainpack.application.UpdateRiskStatusUseCase;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.time.OffsetDateTime;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = UpdateRiskStatusController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("UpdateRiskStatusController")
class UpdateRiskStatusControllerTest {

  private static final String BASE_URL =
      "/api/v1/workspaces/1/domain-packs/7/versions/10/risks/55/status";

  private final MockMvc mockMvc;
  private final ObjectMapper objectMapper;

  @MockitoBean private UpdateRiskStatusUseCase useCase;

  @Autowired
  UpdateRiskStatusControllerTest(MockMvc mockMvc, ObjectMapper objectMapper) {
    this.mockMvc = mockMvc;
    this.objectMapper = objectMapper;
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}/status: INACTIVE 전환 → 200")
  @WithLongPrincipal(5L)
  void should_200반환_when_INACTIVE전환() throws Exception {
    given(useCase.execute(any())).willReturn(sampleResponse("INACTIVE"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "INACTIVE"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("INACTIVE"));
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}/status: ACTIVE 전환 → 200")
  @WithLongPrincipal(5L)
  void should_200반환_when_ACTIVE전환() throws Exception {
    given(useCase.execute(any())).willReturn(sampleResponse("ACTIVE"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "ACTIVE"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ACTIVE"));
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}/status: 허용되지 않는 status 값이면 400")
  @WithLongPrincipal(5L)
  void should_400반환_when_잘못된status() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new BadRequestException("VALIDATION_ERROR", "허용되지 않는 status 값입니다: DEPRECATED"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "DEPRECATED"))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}/status: PUBLISHED 버전이면 400 RISK_NOT_EDITABLE")
  @WithLongPrincipal(5L)
  void should_400반환_when_PUBLISHED버전() throws Exception {
    given(useCase.execute(any()))
        .willThrow(
            new BadRequestException("RISK_NOT_EDITABLE", "DRAFT 상태의 버전에서만 위험요소를 수정할 수 있습니다."));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "INACTIVE"))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("RISK_NOT_EDITABLE"));
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}/status: 위험요소 미존재 시 404")
  @WithLongPrincipal(5L)
  void should_404반환_when_위험요소미존재() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new NotFoundException("NOT_FOUND", "위험요소를 찾을 수 없습니다: 55"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "INACTIVE"))))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}/status: 워크스페이스 멤버십 없을 때 403")
  @WithLongPrincipal(5L)
  void should_403반환_when_비멤버() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("접근 권한이 없습니다."));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "INACTIVE"))))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}/status: 워크스페이스 없을 때 404")
  @WithLongPrincipal(5L)
  void should_404반환_when_워크스페이스없음() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new DomainPackWorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다. id=1"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "INACTIVE"))))
        .andExpect(status().isNotFound());
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}/status: status 공백값이면 400")
  @WithLongPrincipal(5L)
  void should_400반환_when_statusBlank() throws Exception {
    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", ""))))
        .andExpect(status().isBadRequest());

    verifyNoInteractions(useCase);
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}/status: status 키 누락 시 400")
  @WithLongPrincipal(5L)
  void should_400반환_when_statusMissing() throws Exception {
    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isBadRequest());

    verifyNoInteractions(useCase);
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}/status: 인증 없는 요청 → 401")
  void should_401반환_when_인증없음() throws Exception {
    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "INACTIVE"))))
        .andExpect(status().isUnauthorized());

    verifyNoInteractions(useCase);
  }

  private RiskDefinitionResponse sampleResponse(String status) {
    return new RiskDefinitionResponse(
        55L,
        10L,
        "payment_dispute_risk",
        "결제 분쟁 위험",
        "수정 설명",
        "HIGH",
        "{}",
        "{}",
        "[]",
        "{}",
        status,
        OffsetDateTime.parse("2026-04-16T10:00:00Z"),
        OffsetDateTime.parse("2026-04-16T10:30:00Z"));
  }
}
