package com.init.workspace.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.application.exception.WorkspaceInvalidDescriptionException;
import com.init.workspace.application.exception.WorkspaceInvalidNameException;
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
@DisplayName("UpdateWorkspaceUseCase")
class UpdateWorkspaceUseCaseTest {

  @Mock private WorkspaceRepository workspaceRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;

  private UpdateWorkspaceUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new UpdateWorkspaceUseCase(workspaceRepository, workspaceMemberRepository);
  }

  @Test
  @DisplayName("OWNER 수정 → name과 description 변경")
  void should_name과Description수정_when_owner() {
    Workspace workspace = buildWorkspace("Old Name", "old");
    WorkspaceMember member = WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.OWNER);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(member));
    given(workspaceRepository.save(workspace)).willReturn(workspace);

    WorkspaceResult result =
        useCase.execute(new UpdateWorkspaceCommand(1L, 7L, true, "New Name", true, "new"));

    assertThat(result.name()).isEqualTo("New Name");
    assertThat(result.description()).isEqualTo("new");
  }

  @Test
  @DisplayName("description null 명시 전달 → 설명 제거")
  void should_description제거_when_descriptionNull전달() {
    Workspace workspace = buildWorkspace("Old Name", "old");
    WorkspaceMember member = WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.ADMIN);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(member));
    given(workspaceRepository.save(workspace)).willReturn(workspace);

    WorkspaceResult result =
        useCase.execute(new UpdateWorkspaceCommand(1L, 7L, false, null, true, null));

    assertThat(result.description()).isNull();
  }

  @Test
  @DisplayName("name null 명시 전달 → WorkspaceInvalidNameException")
  void should_WorkspaceInvalidNameException_when_nameNull전달() {
    given(workspaceRepository.findById(1L))
        .willReturn(Optional.of(buildWorkspace("Old Name", "old")));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.OWNER)));

    assertThatThrownBy(
            () -> useCase.execute(new UpdateWorkspaceCommand(1L, 7L, true, null, false, null)))
        .isInstanceOf(WorkspaceInvalidNameException.class);
  }

  @Test
  @DisplayName("description 2000자 초과 → WorkspaceInvalidDescriptionException")
  void should_WorkspaceInvalidDescriptionException_when_description길이초과() {
    given(workspaceRepository.findById(1L))
        .willReturn(Optional.of(buildWorkspace("Old Name", "old")));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.OWNER)));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateWorkspaceCommand(1L, 7L, false, null, true, "x".repeat(2001))))
        .isInstanceOf(WorkspaceInvalidDescriptionException.class);
  }

  @Test
  @DisplayName("REVIEWER 수정 시도 → WorkspaceAccessDeniedException")
  void should_WorkspaceAccessDeniedException_when_reviewer() {
    given(workspaceRepository.findById(1L))
        .willReturn(Optional.of(buildWorkspace("Old Name", "old")));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.REVIEWER)));

    assertThatThrownBy(
            () ->
                useCase.execute(new UpdateWorkspaceCommand(1L, 7L, true, "New Name", false, null)))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
  }

  private Workspace buildWorkspace(String name, String description) {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), name, description);
    ReflectionTestUtils.setField(workspace, "id", 1L);
    ReflectionTestUtils.setField(
        workspace, "createdAt", OffsetDateTime.parse("2026-04-14T00:00:00Z"));
    ReflectionTestUtils.setField(
        workspace, "updatedAt", OffsetDateTime.parse("2026-04-14T00:00:00Z"));
    return workspace;
  }
}
