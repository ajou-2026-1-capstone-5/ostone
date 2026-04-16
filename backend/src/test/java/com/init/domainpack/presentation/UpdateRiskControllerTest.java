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
import com.init.domainpack.application.UpdateRiskUseCase;
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
    value = UpdateRiskController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("UpdateRiskController")
class UpdateRiskControllerTest {

  private static final String BASE_URL = "/api/v1/workspaces/1/domain-packs/7/versions/10/risks/55";

  private final MockMvc mockMvc;
  private final ObjectMapper objectMapper;

  @MockitoBean private UpdateRiskUseCase useCase;

  @Autowired
  UpdateRiskControllerTest(MockMvc mockMvc, ObjectMapper objectMapper) {
    this.mockMvc = mockMvc;
    this.objectMapper = objectMapper;
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}: DRAFT 버전 위험요소 정상 수정 → 200")
  @WithLongPrincipal(5L)
  void should_200반환_when_정상수정() throws Exception {
    given(useCase.execute(any())).willReturn(sampleResponse("ACTIVE"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        Map.of("name", "결제 분쟁 위험", "description", "수정 설명"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(55))
        .andExpect(jsonPath("$.name").value("결제 분쟁 위험"))
        .andExpect(jsonPath("$.status").value("ACTIVE"));
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}: PUBLISHED 버전이면 400 RISK_NOT_EDITABLE")
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
                .content(objectMapper.writeValueAsString(Map.of("name", "이름"))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("RISK_NOT_EDITABLE"));
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}: 위험요소 미존재 시 404")
  @WithLongPrincipal(5L)
  void should_404반환_when_위험요소미존재() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new NotFoundException("NOT_FOUND", "위험요소를 찾을 수 없습니다: 55"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", "이름"))))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}: name이 빈 값이면 400 VALIDATION_ERROR")
  @WithLongPrincipal(5L)
  void should_400반환_when_nameBlank() throws Exception {
    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", ""))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

    verifyNoInteractions(useCase);
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}: 워크스페이스 멤버십 없을 때 403")
  @WithLongPrincipal(5L)
  void should_403반환_when_비멤버() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("접근 권한이 없습니다."));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", "이름"))))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}: 워크스페이스 없을 때 404")
  @WithLongPrincipal(5L)
  void should_404반환_when_워크스페이스없음() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new DomainPackWorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다. id=1"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", "이름"))))
        .andExpect(status().isNotFound());
  }

  @Test
  @DisplayName("PATCH /risks/{riskId}: 인증 없는 요청 → 401")
  void should_401반환_when_인증없음() throws Exception {
    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", "이름"))))
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
