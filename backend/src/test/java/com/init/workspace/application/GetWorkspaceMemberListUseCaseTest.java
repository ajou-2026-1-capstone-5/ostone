package com.init.workspace.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;

import com.init.shared.application.exception.BadRequestException;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetWorkspaceMemberListUseCase")
class GetWorkspaceMemberListUseCaseTest {

  @Mock private WorkspaceMemberRepository workspaceMemberRepository;
  @Mock private WorkspaceMemberSearchPort workspaceMemberSearchPort;

  private GetWorkspaceMemberListUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new GetWorkspaceMemberListUseCase(workspaceMemberRepository, workspaceMemberSearchPort);
  }

  @Test
  @DisplayName("OWNER 요청 → 멤버 목록 반환")
  void should_returnMembers_when_ownerRequests() {
    WorkspaceMember requester = WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.OWNER);
    WorkspaceMemberListEntry entry = memberEntry("OWNER");
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(requester));
    given(workspaceMemberSearchPort.searchMembers(1L, "admin", WorkspaceMemberRole.ADMIN))
        .willReturn(List.of(entry));

    List<WorkspaceMemberListEntry> result =
        useCase.execute(new GetWorkspaceMemberListQuery(1L, 7L, "admin", "ADMIN"));

    assertThat(result).containsExactly(entry);
  }

  @Test
  @DisplayName("ADMIN 요청 → 멤버 목록 반환")
  void should_returnMembers_when_adminRequests() {
    WorkspaceMember requester = WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.ADMIN);
    WorkspaceMemberListEntry entry = memberEntry("ADMIN");
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(requester));
    given(workspaceMemberSearchPort.searchMembers(1L, null, null)).willReturn(List.of(entry));

    List<WorkspaceMemberListEntry> result =
        useCase.execute(new GetWorkspaceMemberListQuery(1L, 7L, null, null));

    assertThat(result).containsExactly(entry);
  }

  @Test
  @DisplayName("OPERATOR 요청 → WorkspaceAccessDeniedException")
  void should_throwAccessDenied_when_operatorRequests() {
    WorkspaceMember requester = WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.OPERATOR);
    GetWorkspaceMemberListQuery query = new GetWorkspaceMemberListQuery(1L, 7L, null, null);
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(requester));

    assertThatThrownBy(() -> useCase.execute(query))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
    verifyNoInteractions(workspaceMemberSearchPort);
  }

  @Test
  @DisplayName("비멤버 요청 → WorkspaceAccessDeniedException")
  void should_throwAccessDenied_when_notMember() {
    GetWorkspaceMemberListQuery query = new GetWorkspaceMemberListQuery(1L, 7L, null, null);
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> useCase.execute(query))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
    verifyNoInteractions(workspaceMemberSearchPort);
  }

  @Test
  @DisplayName("잘못된 role 필터 → BadRequestException")
  void should_throwInvalidRole_when_roleUnknown() {
    WorkspaceMember requester = WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.OWNER);
    GetWorkspaceMemberListQuery query = new GetWorkspaceMemberListQuery(1L, 7L, null, "BAD");
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(requester));

    assertThatThrownBy(() -> useCase.execute(query))
        .isInstanceOf(BadRequestException.class)
        .extracting("code")
        .isEqualTo("WORKSPACE_INVALID_MEMBER_ROLE");
    verifyNoInteractions(workspaceMemberSearchPort);
  }

  private WorkspaceMemberListEntry memberEntry(String role) {
    return new WorkspaceMemberListEntry(
        10L,
        7L,
        "Admin",
        "admin@ostone.com",
        role,
        OffsetDateTime.parse("2026-04-14T00:00:00Z"),
        "ACTIVE");
  }
}
