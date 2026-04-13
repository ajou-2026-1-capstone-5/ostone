package com.init.workspace.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willDoNothing;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workspace.application.ArchiveWorkspaceUseCase;
import com.init.workspace.application.CreateWorkspaceUseCase;
import com.init.workspace.application.GetWorkspaceListUseCase;
import com.init.workspace.application.GetWorkspaceUseCase;
import com.init.workspace.application.UpdateWorkspaceUseCase;
import com.init.workspace.application.WorkspaceResult;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.application.exception.WorkspaceInvalidKeyException;
import com.init.workspace.application.exception.WorkspaceInvalidNameException;
import com.init.workspace.application.exception.WorkspaceKeyAlreadyExistsException;
import com.init.workspace.application.exception.WorkspaceNotFoundException;
import java.time.OffsetDateTime;
import java.util.List;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = WorkspaceController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("WorkspaceController")
class WorkspaceControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private CreateWorkspaceUseCase createWorkspaceUseCase;
  @MockitoBean private GetWorkspaceListUseCase getWorkspaceListUseCase;
  @MockitoBean private GetWorkspaceUseCase getWorkspaceUseCase;
  @MockitoBean private UpdateWorkspaceUseCase updateWorkspaceUseCase;
  @MockitoBean private ArchiveWorkspaceUseCase archiveWorkspaceUseCase;

  @Test
  @DisplayName("POST 유효한 요청 → 201 Created")
  void should_201Created_when_유효한요청() throws Exception {
    given(createWorkspaceUseCase.execute(any())).willReturn(result("OWNER"));

    mockMvc
        .perform(
            post("/api/v1/workspaces")
                .principal(auth())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workspaceKey": "cs-team-alpha",
                      "name": "CS Team Alpha",
                      "description": "desc"
                    }
                    """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.workspaceKey").value("cs-team-alpha"))
        .andExpect(jsonPath("$.myRole").value("OWNER"));
  }

  @Test
  @DisplayName("POST 잘못된 key → 400 WORKSPACE_INVALID_KEY")
  void should_400반환_when_잘못된Key() throws Exception {
    given(createWorkspaceUseCase.execute(any()))
        .willThrow(new WorkspaceInvalidKeyException("workspaceKey 형식이 올바르지 않습니다."));

    mockMvc
        .perform(
            post("/api/v1/workspaces")
                .principal(auth())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workspaceKey": "BAD_KEY",
                      "name": "CS Team Alpha"
                    }
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("WORKSPACE_INVALID_KEY"));
  }

  @Test
  @DisplayName("POST 인증 누락 → 401 UNAUTHORIZED")
  void should_401반환_when_인증누락() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/workspaces")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workspaceKey": "cs-team-alpha",
                      "name": "CS Team Alpha"
                    }
                    """))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }

  @Test
  @DisplayName("GET 목록 조회 → 200 OK")
  void should_200반환_when_목록조회() throws Exception {
    given(getWorkspaceListUseCase.execute(7L)).willReturn(List.of(result("OWNER")));

    mockMvc
        .perform(get("/api/v1/workspaces").principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(1))
        .andExpect(jsonPath("$[0].myRole").value("OWNER"));
  }

  @Test
  @DisplayName("GET 단건 비멤버 → 403 WORKSPACE_ACCESS_DENIED")
  void should_403반환_when_비멤버() throws Exception {
    given(getWorkspaceUseCase.execute(1L, 7L))
        .willThrow(new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));

    mockMvc
        .perform(get("/api/v1/workspaces/1").principal(auth()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("WORKSPACE_ACCESS_DENIED"));
  }

  @Test
  @DisplayName("PATCH description null 전달 → 200 OK")
  void should_200반환_when_descriptionNull전달() throws Exception {
    WorkspaceResult result = new WorkspaceResult(1L, "cs-team-alpha", "CS Team", null, "ACTIVE", "OWNER",
        OffsetDateTime.parse("2026-04-14T00:00:00Z"), OffsetDateTime.parse("2026-04-14T00:00:00Z"));
    given(updateWorkspaceUseCase.execute(any())).willReturn(result);

    mockMvc
        .perform(
            patch("/api/v1/workspaces/1")
                .principal(auth())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "description": null
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.description").value(Matchers.nullValue()));
  }

  @Test
  @DisplayName("PATCH 잘못된 name → 400 WORKSPACE_INVALID_NAME")
  void should_400반환_when_잘못된Name() throws Exception {
    given(updateWorkspaceUseCase.execute(any()))
        .willThrow(new WorkspaceInvalidNameException("워크스페이스 이름이 올바르지 않습니다."));

    mockMvc
        .perform(
            patch("/api/v1/workspaces/1")
                .principal(auth())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": null
                    }
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("WORKSPACE_INVALID_NAME"));
  }

  @Test
  @DisplayName("DELETE OWNER 삭제 → 204 No Content")
  void should_204반환_when_owner삭제() throws Exception {
    willDoNothing().given(archiveWorkspaceUseCase).execute(1L, 7L);

    mockMvc
        .perform(delete("/api/v1/workspaces/1").principal(auth()).with(csrf()))
        .andExpect(status().isNoContent());
  }

  @Test
  @DisplayName("DELETE 존재하지 않는 workspace → 404 WORKSPACE_NOT_FOUND")
  void should_404반환_when_workspace없음() throws Exception {
    org.mockito.BDDMockito.willThrow(new WorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다."))
        .given(archiveWorkspaceUseCase)
        .execute(1L, 7L);

    mockMvc
        .perform(delete("/api/v1/workspaces/1").principal(auth()).with(csrf()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));
  }

  @Test
  @DisplayName("POST 중복 key → 409 WORKSPACE_KEY_CONFLICT")
  void should_409반환_when_key중복() throws Exception {
    given(createWorkspaceUseCase.execute(any()))
        .willThrow(new WorkspaceKeyAlreadyExistsException("이미 사용 중인 워크스페이스 키입니다."));

    mockMvc
        .perform(
            post("/api/v1/workspaces")
                .principal(auth())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workspaceKey": "cs-team-alpha",
                      "name": "CS Team Alpha"
                    }
                    """))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("WORKSPACE_KEY_CONFLICT"));
  }

  private WorkspaceResult result(String role) {
    return new WorkspaceResult(
        1L,
        "cs-team-alpha",
        "CS Team Alpha",
        "desc",
        "ACTIVE",
        role,
        OffsetDateTime.parse("2026-04-14T00:00:00Z"),
        OffsetDateTime.parse("2026-04-14T00:00:00Z"));
  }

  private UsernamePasswordAuthenticationToken auth() {
    return new UsernamePasswordAuthenticationToken(
        7L, null, List.of(new SimpleGrantedAuthority("ROLE_OPERATOR")));
  }
}
