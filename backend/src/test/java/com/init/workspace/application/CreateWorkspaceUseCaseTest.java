package com.init.workspace.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.workspace.application.exception.WorkspaceInvalidKeyException;
import com.init.workspace.application.exception.WorkspaceKeyAlreadyExistsException;
import com.init.workspace.domain.model.Workspace;
import com.init.workspace.domain.model.WorkspaceKey;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import com.init.workspace.domain.repository.WorkspaceRepository;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("CreateWorkspaceUseCase")
class CreateWorkspaceUseCaseTest {

  @Mock private WorkspaceRepository workspaceRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;

  private CreateWorkspaceUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new CreateWorkspaceUseCase(workspaceRepository, workspaceMemberRepository);
  }

  @Test
  @DisplayName("정상 요청 → workspace와 OWNER 멤버 저장")
  void should_workspace와Owner멤버저장_when_정상요청() {
    Workspace workspace = buildWorkspace(1L, "cs-team-alpha", "CS Team", "desc");
    WorkspaceMember member = buildMember(1L, 7L, WorkspaceMemberRole.OWNER);
    given(workspaceRepository.existsByWorkspaceKey(any())).willReturn(false);
    given(workspaceRepository.save(any())).willReturn(workspace);
    given(workspaceMemberRepository.save(any())).willReturn(member);

    WorkspaceResult result =
        useCase.execute(new CreateWorkspaceCommand("cs-team-alpha", "CS Team", "desc", 7L));

    assertThat(result.workspaceId()).isEqualTo(1L);
    assertThat(result.myRole()).isEqualTo("OWNER");
    verify(workspaceRepository).save(any());
    verify(workspaceMemberRepository).save(any());
  }

  @Test
  @DisplayName("중복 key 사전 확인 → WorkspaceKeyAlreadyExistsException")
  void should_WorkspaceKeyAlreadyExistsException_when_existsByKeyTrue() {
    given(workspaceRepository.existsByWorkspaceKey(any())).willReturn(true);

    assertThatThrownBy(
            () -> useCase.execute(new CreateWorkspaceCommand("cs-team-alpha", "CS Team", null, 7L)))
        .isInstanceOf(WorkspaceKeyAlreadyExistsException.class);
  }

  @Test
  @DisplayName("잘못된 key 형식 → WorkspaceInvalidKeyException")
  void should_WorkspaceInvalidKeyException_when_key형식위반() {
    assertThatThrownBy(
            () -> useCase.execute(new CreateWorkspaceCommand("BAD_KEY", "CS Team", null, 7L)))
        .isInstanceOf(WorkspaceInvalidKeyException.class);
  }

  @Test
  @DisplayName("저장 시 unique 충돌 → WorkspaceKeyAlreadyExistsException")
  void should_WorkspaceKeyAlreadyExistsException_when_save시DataIntegrityViolation() {
    given(workspaceRepository.existsByWorkspaceKey(any())).willReturn(false);
    given(workspaceRepository.save(any()))
        .willThrow(
            new DataIntegrityViolationException("duplicate key value violates workspace_key"));

    assertThatThrownBy(
            () -> useCase.execute(new CreateWorkspaceCommand("cs-team-alpha", "CS Team", null, 7L)))
        .isInstanceOf(WorkspaceKeyAlreadyExistsException.class);
  }

  private Workspace buildWorkspace(Long id, String key, String name, String description) {
    Workspace workspace = Workspace.create(WorkspaceKey.of(key), name, description);
    ReflectionTestUtils.setField(workspace, "id", id);
    ReflectionTestUtils.setField(
        workspace, "createdAt", OffsetDateTime.parse("2026-04-14T00:00:00Z"));
    ReflectionTestUtils.setField(
        workspace, "updatedAt", OffsetDateTime.parse("2026-04-14T00:00:00Z"));
    return workspace;
  }

  private WorkspaceMember buildMember(Long workspaceId, Long userId, WorkspaceMemberRole role) {
    WorkspaceMember member = WorkspaceMember.create(workspaceId, userId, role);
    ReflectionTestUtils.setField(member, "id", 1L);
    return member;
  }
}
