package com.init.workspace.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.application.exception.WorkspaceNotFoundException;
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

@ExtendWith(MockitoExtension.class)
@DisplayName("GetWorkspaceDashboardHealthUseCase")
class GetWorkspaceDashboardHealthUseCaseTest {

  @Mock private WorkspaceRepository workspaceRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;
  @Mock private WorkspaceDashboardQueryPort workspaceDashboardQueryPort;

  private GetWorkspaceDashboardHealthUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new GetWorkspaceDashboardHealthUseCase(
            workspaceRepository, workspaceMemberRepository, workspaceDashboardQueryPort);
  }

  @Test
  @DisplayName("멤버인 사용자 → 운영 지식팩 건강도 반환")
  void should_health반환_when_멤버인사용자() {
    WorkspaceDashboardHealthResult health = healthResult();
    given(workspaceRepository.existsById(1L)).willReturn(true);
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.ADMIN)));
    given(workspaceDashboardQueryPort.findKnowledgePackHealth(1L)).willReturn(health);

    WorkspaceDashboardHealthResult result = useCase.execute(1L, 7L);

    assertThat(result.activeKnowledgePack().versionNo()).isEqualTo(4);
    assertThat(result.pendingReviewCount()).isEqualTo(2);
  }

  @Test
  @DisplayName("workspace 없음 → WorkspaceNotFoundException")
  void should_WorkspaceNotFoundException_when_workspace없음() {
    given(workspaceRepository.existsById(1L)).willReturn(false);

    assertThatThrownBy(() -> useCase.execute(1L, 7L))
        .isInstanceOf(WorkspaceNotFoundException.class);
  }

  @Test
  @DisplayName("멤버 아님 → WorkspaceAccessDeniedException")
  void should_WorkspaceAccessDeniedException_when_멤버아님() {
    given(workspaceRepository.existsById(1L)).willReturn(true);
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> useCase.execute(1L, 7L))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
  }

  private WorkspaceDashboardHealthResult healthResult() {
    OffsetDateTime now = OffsetDateTime.parse("2026-06-03T10:00:00Z");
    return new WorkspaceDashboardHealthResult(
        new WorkspaceDashboardKnowledgePackResult(11L, "CS Pack", 12L, 4, now, now, 77L),
        new WorkspaceDashboardLogUploadResult(8L, "june-log", "6월 상담 로그", "READY", now),
        new WorkspaceDashboardGenerationResult(77L, 8L, 11L, "SUCCEEDED", now, now, now, null),
        2L);
  }
}
