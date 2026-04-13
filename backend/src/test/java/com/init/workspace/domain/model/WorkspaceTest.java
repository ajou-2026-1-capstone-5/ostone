package com.init.workspace.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Workspace")
class WorkspaceTest {

  @Test
  @DisplayName("유효한 인자 → ACTIVE 상태로 생성")
  void should_생성성공_when_유효한인자() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");

    assertThat(workspace.getStatus()).isEqualTo(WorkspaceStatus.ACTIVE);
    assertThat(workspace.getName()).isEqualTo("CS Team");
  }

  @Test
  @DisplayName("description null 허용 → update 성공")
  void should_update성공_when_descriptionNull() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");

    workspace.update("New Name", null);

    assertThat(workspace.getName()).isEqualTo("New Name");
    assertThat(workspace.getDescription()).isNull();
  }

  @Test
  @DisplayName("blank name으로 update → IllegalArgumentException")
  void should_IllegalArgumentException_when_updateNameBlank() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");

    assertThatThrownBy(() -> workspace.update(" ", "desc"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("archive 호출 → ARCHIVED 상태로 변경")
  void should_archive성공_when_active상태() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");

    workspace.archive();

    assertThat(workspace.getStatus()).isEqualTo(WorkspaceStatus.ARCHIVED);
  }

  @Test
  @DisplayName("이미 ARCHIVED 상태에서 archive 호출 → IllegalStateException")
  void should_IllegalStateException_when_이미Archived() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");
    workspace.archive();

    assertThatThrownBy(workspace::archive).isInstanceOf(IllegalStateException.class);
  }
}
