package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.IntentDefinitionStatusResponse;
import com.init.domainpack.application.UpdateIntentStatusUseCase;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
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
    value = UpdateIntentStatusController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("UpdateIntentStatusController")
class UpdateIntentStatusControllerTest {

  private final MockMvc mockMvc;
  private final ObjectMapper objectMapper;

  @MockitoBean private UpdateIntentStatusUseCase useCase;

  @Autowired
  UpdateIntentStatusControllerTest(MockMvc mockMvc, ObjectMapper objectMapper) {
    this.mockMvc = mockMvc;
    this.objectMapper = objectMapper;
  }

  private static final String BASE_URL =
      "/api/v1/workspaces/1/domain-packs/7/versions/10/intents/99/status";

  @Test
  @DisplayName("PATCH /intents/{intentId}/status: PUBLISHED 전환 → 200")
  @WithLongPrincipal(5L)
  void should_200반환_when_PUBLISHED전환() throws Exception {
    IntentDefinitionStatusResponse response = sampleResponse("PUBLISHED");
    given(useCase.execute(any())).willReturn(response);

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "PUBLISHED"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PUBLISHED"));
  }

  @Test
  @DisplayName("PATCH /intents/{intentId}/status: REJECTED 전환 → 200")
  @WithLongPrincipal(5L)
  void should_200반환_when_REJECTED전환() throws Exception {
    IntentDefinitionStatusResponse response = sampleResponse("REJECTED");
    given(useCase.execute(any())).willReturn(response);

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "REJECTED"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("REJECTED"));
  }

  @Test
  @DisplayName("PATCH /intents/{intentId}/status: 이미 PUBLISHED 상태면 400 VALIDATION_ERROR")
  @WithLongPrincipal(5L)
  void should_400반환_when_이미PUBLISHED상태() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new BadRequestException("VALIDATION_ERROR", "이미 PUBLISHED 상태입니다."));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "PUBLISHED"))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @DisplayName("PATCH /intents/{intentId}/status: status 미전송 시 400")
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
  @DisplayName("PATCH /intents/{intentId}/status: 워크스페이스 멤버십 없을 때 403")
  @WithLongPrincipal(5L)
  void should_403반환_when_비멤버() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("접근 권한이 없습니다."));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "PUBLISHED"))))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("PATCH /intents/{intentId}/status: Intent 미존재 시 404")
  @WithLongPrincipal(5L)
  void should_404반환_when_Intent미존재() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new NotFoundException("NOT_FOUND", "Intent를 찾을 수 없습니다: 99"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "PUBLISHED"))))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("PATCH /intents/{intentId}/status: 인증 없는 요청 → 401")
  void should_401반환_when_인증없음() throws Exception {
    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", "PUBLISHED"))))
        .andExpect(status().isUnauthorized());
    verifyNoInteractions(useCase);
  }

  private IntentDefinitionStatusResponse sampleResponse(String status) {
    return new IntentDefinitionStatusResponse(
        99L,
        10L,
        "intent.customer.lookup",
        "고객 조회",
        "고객 조회 intent",
        2,
        status,
        OffsetDateTime.parse("2026-04-15T10:00:00Z"),
        OffsetDateTime.parse("2026-04-15T10:30:00Z"));
  }
}
