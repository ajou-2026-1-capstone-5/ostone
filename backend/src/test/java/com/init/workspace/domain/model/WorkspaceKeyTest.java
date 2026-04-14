package com.init.workspace.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("WorkspaceKey")
class WorkspaceKeyTest {

  @Test
  @DisplayName("유효한 workspaceKey → 생성 성공")
  void should_생성성공_when_유효한키() {
    assertThat(WorkspaceKey.of("cs-team-alpha").getValue()).isEqualTo("cs-team-alpha");
  }

  @Test
  @DisplayName("null workspaceKey → IllegalArgumentException")
  void should_IllegalArgumentException_when_null() {
    assertThatThrownBy(() -> WorkspaceKey.of(null)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("대문자 포함 workspaceKey → IllegalArgumentException")
  void should_IllegalArgumentException_when_대문자포함() {
    assertThatThrownBy(() -> WorkspaceKey.of("CS-team"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("길이 2 이하 workspaceKey → IllegalArgumentException")
  void should_IllegalArgumentException_when_길이2이하() {
    assertThatThrownBy(() -> WorkspaceKey.of("ab")).isInstanceOf(IllegalArgumentException.class);
  }
}
