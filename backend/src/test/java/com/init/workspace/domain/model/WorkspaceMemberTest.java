package com.init.workspace.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("WorkspaceMember")
class WorkspaceMemberTest {

  @Test
  @DisplayName("유효한 인자 → 생성 성공")
  void should_생성성공_when_유효한인자() {
    WorkspaceMember member = WorkspaceMember.create(1L, 2L, WorkspaceMemberRole.OWNER);

    assertThat(member.getWorkspaceId()).isEqualTo(1L);
    assertThat(member.getUserId()).isEqualTo(2L);
    assertThat(member.getMemberRole()).isEqualTo(WorkspaceMemberRole.OWNER);
  }

  @Test
  @DisplayName("workspaceId null → IllegalArgumentException")
  void should_IllegalArgumentException_when_workspaceIdNull() {
    assertThatThrownBy(() -> WorkspaceMember.create(null, 2L, WorkspaceMemberRole.OWNER))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("userId null → IllegalArgumentException")
  void should_IllegalArgumentException_when_userIdNull() {
    assertThatThrownBy(() -> WorkspaceMember.create(1L, null, WorkspaceMemberRole.OWNER))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("memberRole null → IllegalArgumentException")
  void should_IllegalArgumentException_when_memberRoleNull() {
    assertThatThrownBy(() -> WorkspaceMember.create(1L, 2L, null))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
