package com.init.workflowruntime.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workflowruntime.application.CounselorService;
import com.init.workflowruntime.application.dto.CounselorSessionResponse;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = CounselorSessionController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class CounselorSessionControllerTest {

  @Autowired private MockMvc mockMvc;

  @SuppressWarnings("removal")
  @MockBean
  private CounselorService counselorService;

  @Test
  @DisplayName("POST /api/v1/consultation/sessions/{id}/assign - 배정 성공")
  void should_assignSession_when_validRequest() throws Exception {
    CounselorSessionResponse response = new CounselorSessionResponse();
    response.setId(1L);
    response.setStatus("ACTIVE");
    response.setAssignedCounselorId(42L);
    response.setChannel("WEB");
    response.setStartedAt(OffsetDateTime.now());

    given(counselorService.assignSession(eq(1L), eq(42L))).willReturn(response);

    mockMvc
        .perform(post("/api/v1/consultation/sessions/1/assign").principal(auth(42L)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.status").value("ACTIVE"))
        .andExpect(jsonPath("$.assignedCounselorId").value(42));
  }

  @Test
  @DisplayName("POST /api/v1/consultation/sessions/{id}/assign - query counselorId를 무시한다")
  void should_ignoreCounselorIdQuery_when_assigning() throws Exception {
    CounselorSessionResponse response = new CounselorSessionResponse();
    response.setId(1L);
    response.setStatus("ACTIVE");
    response.setAssignedCounselorId(42L);
    response.setChannel("WEB");
    response.setStartedAt(OffsetDateTime.now());

    given(counselorService.assignSession(eq(1L), eq(42L))).willReturn(response);

    mockMvc
        .perform(
            post("/api/v1/consultation/sessions/1/assign")
                .param("counselorId", "99")
                .principal(auth(42L)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.assignedCounselorId").value(42));
  }

  @Test
  @DisplayName("POST /api/v1/consultation/sessions/{id}/assign - 세션 없음 → 404")
  void should_return404_when_sessionNotFound() throws Exception {
    given(counselorService.assignSession(eq(999L), eq(1L)))
        .willThrow(new NotFoundException("SESSION_NOT_FOUND", "Session not found: 999"));

    mockMvc
        .perform(post("/api/v1/consultation/sessions/999/assign").principal(auth(1L)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("POST /api/v1/consultation/sessions/{id}/assign - 이미 배정됨 → 400")
  void should_return400_when_alreadyAssigned() throws Exception {
    given(counselorService.assignSession(eq(999L), eq(1L)))
        .willThrow(new BadRequestException("ALREADY_ASSIGNED", "Session already assigned"));

    mockMvc
        .perform(post("/api/v1/consultation/sessions/999/assign").principal(auth(1L)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("ALREADY_ASSIGNED"));
  }

  @Test
  @DisplayName("POST /api/v1/consultation/sessions/{id}/release - 해제 성공")
  void should_releaseSession_when_validRequest() throws Exception {
    CounselorSessionResponse response = new CounselorSessionResponse();
    response.setId(1L);
    response.setStatus("OPEN");
    response.setAssignedCounselorId(null);

    given(counselorService.releaseSession(eq(1L), eq(42L))).willReturn(response);

    mockMvc
        .perform(post("/api/v1/consultation/sessions/1/release").principal(auth(42L)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("OPEN"));
  }

  @Test
  @DisplayName("POST /api/v1/consultation/sessions/{id}/assign - 비멤버 → 403")
  void should_return403_when_assignRequesterIsNotWorkspaceMember() throws Exception {
    given(counselorService.assignSession(eq(1L), eq(42L)))
        .willThrow(new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));

    mockMvc
        .perform(post("/api/v1/consultation/sessions/1/assign").principal(auth(42L)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("WORKSPACE_ACCESS_DENIED"));
  }

  @Test
  @DisplayName("POST /api/v1/consultation/sessions/{id}/release - 비멤버 → 403")
  void should_return403_when_releaseRequesterIsNotWorkspaceMember() throws Exception {
    given(counselorService.releaseSession(eq(1L), eq(42L)))
        .willThrow(new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));

    mockMvc
        .perform(post("/api/v1/consultation/sessions/1/release").principal(auth(42L)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("WORKSPACE_ACCESS_DENIED"));
  }

  @Test
  @DisplayName("POST /api/v1/consultation/sessions/{id}/release - query counselorId를 무시한다")
  void should_ignoreCounselorIdQuery_when_releasing() throws Exception {
    CounselorSessionResponse response = new CounselorSessionResponse();
    response.setId(1L);
    response.setStatus("OPEN");
    response.setAssignedCounselorId(null);

    given(counselorService.releaseSession(eq(1L), eq(42L))).willReturn(response);

    mockMvc
        .perform(
            post("/api/v1/consultation/sessions/1/release")
                .param("counselorId", "99")
                .principal(auth(42L)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.assignedCounselorId").isEmpty());
  }

  @Test
  @DisplayName("PATCH /api/v1/consultation/sessions/{id}/response-mode - 응대 모드 변경 성공")
  void should_updateResponseMode_when_validRequest() throws Exception {
    CounselorSessionResponse response = new CounselorSessionResponse();
    response.setId(1L);
    response.setStatus("ACTIVE");
    response.setAssignedCounselorId(42L);
    response.setResponseMode("AI_ASSIST_ONLY");

    given(counselorService.updateResponseMode(eq(1L), any(), eq(42L))).willReturn(response);

    mockMvc
        .perform(
            patch("/api/v1/consultation/sessions/1/response-mode")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"counselorId\":42,\"responseMode\":\"AI_ASSIST_ONLY\"}")
                .principal(auth(42L)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.responseMode").value("AI_ASSIST_ONLY"));
  }

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/consultation/sessions - 전체 세션 목록 조회")
  void should_returnSessions_when_noStatusFilter() throws Exception {
    CounselorSessionResponse response = new CounselorSessionResponse(List.of(), 0, 20, 0, 0);

    given(
            counselorService.getSessions(
                eq(1L),
                eq(7L),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(0),
                eq(20)))
        .willReturn(response);

    mockMvc
        .perform(
            get("/api/v1/workspaces/1/consultation/sessions")
                .param("page", "0")
                .param("size", "20")
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content").isArray());
  }

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/consultation/sessions - 상태 필터 조회")
  void should_returnSessions_when_statusFilter() throws Exception {
    CounselorSessionResponse response = new CounselorSessionResponse(List.of(), 0, 20, 0, 0);

    given(
            counselorService.getSessions(
                eq(1L),
                eq(7L),
                eq("OPEN"),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(0),
                eq(20)))
        .willReturn(response);

    mockMvc
        .perform(
            get("/api/v1/workspaces/1/consultation/sessions")
                .param("status", "OPEN")
                .param("page", "0")
                .param("size", "20")
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content").isArray());
  }

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/consultation/sessions - 검색/필터 query 전달")
  void should_returnSessions_when_searchFiltersGiven() throws Exception {
    CounselorSessionResponse response = new CounselorSessionResponse(List.of(), 1, 20, 0, 0);

    given(
            counselorService.getSessions(
                eq(1L),
                eq(7L),
                eq("COMPLETED"),
                eq("환불"),
                eq(LocalDate.of(2026, 5, 1)),
                eq(LocalDate.of(2026, 5, 31)),
                eq(42L),
                eq(1),
                eq(20)))
        .willReturn(response);

    mockMvc
        .perform(
            get("/api/v1/workspaces/1/consultation/sessions")
                .param("status", "COMPLETED")
                .param("keyword", "환불")
                .param("startedFrom", "2026-05-01")
                .param("startedTo", "2026-05-31")
                .param("assignedCounselorId", "42")
                .param("page", "1")
                .param("size", "20")
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.page").value(1));
  }

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/consultation/sessions - 유효하지 않은 상태 → 400")
  void should_return400_when_invalidStatus() throws Exception {
    given(
            counselorService.getSessions(
                eq(1L),
                eq(7L),
                eq("INVALID"),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                anyInt(),
                anyInt()))
        .willThrow(new BadRequestException("UNSUPPORTED_STATUS", "Unsupported status: INVALID"));

    mockMvc
        .perform(
            get("/api/v1/workspaces/1/consultation/sessions")
                .param("status", "INVALID")
                .param("page", "0")
                .param("size", "20")
                .principal(auth()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("UNSUPPORTED_STATUS"));
  }

  private UsernamePasswordAuthenticationToken auth(Long userId) {
    return new UsernamePasswordAuthenticationToken(
        userId, null, List.of(new SimpleGrantedAuthority("ROLE_OPERATOR")));
  }
}
