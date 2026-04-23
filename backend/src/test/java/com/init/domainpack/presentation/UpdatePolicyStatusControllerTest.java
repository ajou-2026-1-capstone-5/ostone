package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.PolicyDefinitionResponse;
import com.init.domainpack.application.UpdatePolicyStatusUseCase;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.PolicyCodeReferencedByWorkflowException;
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
    value = UpdatePolicyStatusController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("UpdatePolicyStatusController")
class UpdatePolicyStatusControllerTest {

  private static final String BASE_URL =
      "/api/v1/workspaces/1/domain-packs/7/versions/10/policies/55/status";

  private final MockMvc mockMvc;
  private final ObjectMapper objectMapper;

  @MockitoBean private UpdatePolicyStatusUseCase useCase;

  @Autowired
  UpdatePolicyStatusControllerTest(MockMvc mockMvc, ObjectMapper objectMapper) {
    this.mockMvc = mockMvc;
    this.objectMapper = objectMapper;
  }

  @Test
  @DisplayName("PATCH /policies/{policyId}/status: INACTIVE 전환 → 200")
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
  @DisplayName("PATCH /policies/{policyId}/status: 허용되지 않는 status 값이면 400")
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
  @DisplayName("PATCH /policies/{policyId}/status: PUBLISHED 버전이면 400 POLICY_NOT_EDITABLE")
  @WithLongPrincipal(5L)
  void should_400반환_when_PUBLISHED버전() throws Exception {
    given(useCase.execute(any()))
        .willThrow(
            new BadRequestException("POLICY_NOT_EDITABLE", "DRAFT 상태의 버전에서만 정책을 수정할 수 있습니다."));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "INACTIVE"))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("POLICY_NOT_EDITABLE"));
  }

  @Test
  @DisplayName("PATCH /policies/{policyId}/status: 정책 미존재 시 404")
  @WithLongPrincipal(5L)
  void should_404반환_when_정책미존재() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new NotFoundException("NOT_FOUND", "정책을 찾을 수 없습니다: 55"));

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
  @DisplayName("PATCH /policies/{policyId}/status: 워크스페이스 멤버십 없을 때 403")
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
  @DisplayName("PATCH /policies/{policyId}/status: status 미전송 시 400")
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
  @DisplayName("PATCH /policies/{policyId}/status: INACTIVE 전환 시 policyRef 참조 workflow 존재 → 400")
  @WithLongPrincipal(5L)
  void should_400반환_when_INACTIVE전환시참조workflow존재() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new PolicyCodeReferencedByWorkflowException("refund_check"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "INACTIVE"))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("POLICY_CODE_REFERENCED_BY_WORKFLOW"));
  }

  @Test
  @DisplayName("PATCH /policies/{policyId}/status: 인증 없는 요청 → 401")
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

  private PolicyDefinitionResponse sampleResponse(String status) {
    return new PolicyDefinitionResponse(
        55L,
        10L,
        "refund_check",
        "환불 정책",
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
