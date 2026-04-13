package com.init.workspace.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.model.Workspace;
import com.init.workspace.domain.model.WorkspaceKey;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import com.init.workspace.domain.repository.WorkspaceRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("ArchiveWorkspaceUseCase")
class ArchiveWorkspaceUseCaseTest {

  @Mock private WorkspaceRepository workspaceRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;

  private ArchiveWorkspaceUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new ArchiveWorkspaceUseCase(workspaceRepository, workspaceMemberRepository);
  }

  @Test
  @DisplayName("OWNER 삭제 → save 호출")
  void should_save호출_when_owner삭제() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");
    ReflectionTestUtils.setField(workspace, "id", 1L);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.OWNER)));

    useCase.execute(1L, 7L);

    verify(workspaceRepository).save(workspace);
  }

  @Test
  @DisplayName("이미 ARCHIVED 상태 → save 미호출")
  void should_save미호출_when_이미Archived() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");
    workspace.archive();
    ReflectionTestUtils.setField(workspace, "id", 1L);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.OWNER)));

    useCase.execute(1L, 7L);

    verify(workspaceRepository, never()).save(workspace);
  }

  @Test
  @DisplayName("ADMIN 삭제 시도 → WorkspaceAccessDeniedException")
  void should_WorkspaceAccessDeniedException_when_admin삭제시도() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");
    ReflectionTestUtils.setField(workspace, "id", 1L);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.ADMIN)));

    assertThatThrownBy(() -> useCase.execute(1L, 7L))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
  }
}
