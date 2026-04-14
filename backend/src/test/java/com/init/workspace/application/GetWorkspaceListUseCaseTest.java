package com.init.workspace.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

import com.init.workspace.domain.model.Workspace;
import com.init.workspace.domain.model.WorkspaceKey;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import com.init.workspace.domain.repository.WorkspaceRepository;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.SliceImpl;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetWorkspaceListUseCase")
class GetWorkspaceListUseCaseTest {

  @Mock private WorkspaceMemberRepository workspaceMemberRepository;
  @Mock private WorkspaceRepository workspaceRepository;

  private GetWorkspaceListUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new GetWorkspaceListUseCase(workspaceMemberRepository, workspaceRepository);
  }

  @Test
  @DisplayName("멤버십이 없으면 빈 목록 반환")
  void should_returnEmptyList_when_noMemberships() {
    given(workspaceMemberRepository.findByUserId(eq(7L), any()))
        .willReturn(new SliceImpl<>(List.of(), PageRequest.of(0, 100), false));

    List<WorkspaceResult> result = useCase.execute(7L);

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("멤버십이 여러 페이지면 모두 조회")
  void should_returnAllWorkspaces_when_membershipsSpanMultiplePages() {
    WorkspaceMember firstMembership = buildMember(1L, 7L, WorkspaceMemberRole.OWNER);
    WorkspaceMember secondMembership = buildMember(2L, 7L, WorkspaceMemberRole.ADMIN);
    Slice<WorkspaceMember> firstPage =
        new SliceImpl<>(List.of(firstMembership), PageRequest.of(0, 100), true);
    Slice<WorkspaceMember> secondPage =
        new SliceImpl<>(List.of(secondMembership), PageRequest.of(1, 100), false);

    given(workspaceMemberRepository.findByUserId(7L, PageRequest.of(0, 100))).willReturn(firstPage);
    given(workspaceMemberRepository.findByUserId(7L, PageRequest.of(1, 100)))
        .willReturn(secondPage);
    given(workspaceRepository.findAllByIdIn(List.of(1L)))
        .willReturn(List.of(buildWorkspace(1L, "cs-team-alpha", "Alpha")));
    given(workspaceRepository.findAllByIdIn(List.of(2L)))
        .willReturn(List.of(buildWorkspace(2L, "cs-team-beta", "Beta")));

    List<WorkspaceResult> result = useCase.execute(7L);

    assertThat(result).hasSize(2);
    assertThat(result).extracting(WorkspaceResult::workspaceId).containsExactly(1L, 2L);
    assertThat(result).extracting(WorkspaceResult::myRole).containsExactly("OWNER", "ADMIN");
  }

  private Workspace buildWorkspace(Long id, String key, String name) {
    Workspace workspace = Workspace.create(WorkspaceKey.of(key), name, null);
    ReflectionTestUtils.setField(workspace, "id", id);
    ReflectionTestUtils.setField(
        workspace, "createdAt", OffsetDateTime.parse("2026-04-14T00:00:00Z"));
    ReflectionTestUtils.setField(
        workspace, "updatedAt", OffsetDateTime.parse("2026-04-14T00:00:00Z"));
    return workspace;
  }

  private WorkspaceMember buildMember(Long workspaceId, Long userId, WorkspaceMemberRole role) {
    WorkspaceMember member = WorkspaceMember.create(workspaceId, userId, role);
    ReflectionTestUtils.setField(member, "id", workspaceId);
    ReflectionTestUtils.setField(member, "joinedAt", OffsetDateTime.parse("2026-04-14T00:00:00Z"));
    return member;
  }
}
