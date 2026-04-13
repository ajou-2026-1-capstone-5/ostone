package com.init.workspace.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.application.exception.WorkspaceNotFoundException;
import com.init.workspace.domain.model.Workspace;
import com.init.workspace.domain.model.WorkspaceKey;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import com.init.workspace.domain.repository.WorkspaceRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetWorkspaceUseCase")
class GetWorkspaceUseCaseTest {

  @Mock private WorkspaceRepository workspaceRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;

  private GetWorkspaceUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new GetWorkspaceUseCase(workspaceRepository, workspaceMemberRepository);
  }

  @Test
  @DisplayName("멤버인 사용자 → workspace 반환")
  void should_workspace반환_when_멤버인사용자() {
    Workspace workspace = buildWorkspace();
    WorkspaceMember member = WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.ADMIN);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(member));

    WorkspaceResult result = useCase.execute(1L, 7L);

    assertThat(result.workspaceId()).isEqualTo(1L);
    assertThat(result.myRole()).isEqualTo("ADMIN");
  }

  @Test
  @DisplayName("workspace 없음 → WorkspaceNotFoundException")
  void should_WorkspaceNotFoundException_when_workspace없음() {
    given(workspaceRepository.findById(1L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> useCase.execute(1L, 7L))
        .isInstanceOf(WorkspaceNotFoundException.class);
  }

  @Test
  @DisplayName("멤버 아님 → WorkspaceAccessDeniedException")
  void should_WorkspaceAccessDeniedException_when_멤버아님() {
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(buildWorkspace()));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> useCase.execute(1L, 7L))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
  }

  private Workspace buildWorkspace() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");
    ReflectionTestUtils.setField(workspace, "id", 1L);
    ReflectionTestUtils.setField(
        workspace, "createdAt", OffsetDateTime.parse("2026-04-14T00:00:00Z"));
    ReflectionTestUtils.setField(
        workspace, "updatedAt", OffsetDateTime.parse("2026-04-14T00:00:00Z"));
    return workspace;
  }
}
