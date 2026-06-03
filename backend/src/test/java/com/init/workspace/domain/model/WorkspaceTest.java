package com.init.workspace.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
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

  @Test
  @DisplayName("startFreeOnboarding: AVAILABLE이면 IN_PROGRESS로 전환하고 dataset을 기록한다")
  void should_startFreeOnboarding_when_available() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");
    OffsetDateTime now = OffsetDateTime.parse("2026-06-04T00:00:00Z");

    workspace.startFreeOnboarding(10L, now);

    assertThat(workspace.getFreeOnboardingStatus()).isEqualTo(FreeOnboardingStatus.IN_PROGRESS);
    assertThat(workspace.getFreeOnboardingDatasetId()).isEqualTo(10L);
    assertThat(workspace.getFreeOnboardingStartedAt()).isEqualTo(now);
  }

  @Test
  @DisplayName("consumeFreeOnboarding: 연결된 pipeline job이면 CONSUMED로 전환한다")
  void should_consumeFreeOnboarding_when_attachedPipelineJobFinalized() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");
    workspace.startFreeOnboarding(10L, OffsetDateTime.parse("2026-06-04T00:00:00Z"));
    workspace.attachFreeOnboardingPipelineJob(10L, 20L);
    OffsetDateTime consumedAt = OffsetDateTime.parse("2026-06-04T01:00:00Z");

    boolean consumed = workspace.consumeFreeOnboarding(20L, consumedAt);

    assertThat(consumed).isTrue();
    assertThat(workspace.getFreeOnboardingStatus()).isEqualTo(FreeOnboardingStatus.CONSUMED);
    assertThat(workspace.getFreeOnboardingConsumedAt()).isEqualTo(consumedAt);
  }

  @Test
  @DisplayName("consumeFreeOnboarding: 다른 pipeline job이면 상태를 유지한다")
  void should_ignoreConsumeFreeOnboarding_when_differentPipelineJob() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");
    workspace.startFreeOnboarding(10L, OffsetDateTime.parse("2026-06-04T00:00:00Z"));
    workspace.attachFreeOnboardingPipelineJob(10L, 20L);

    boolean consumed =
        workspace.consumeFreeOnboarding(21L, OffsetDateTime.parse("2026-06-04T01:00:00Z"));

    assertThat(consumed).isFalse();
    assertThat(workspace.getFreeOnboardingStatus()).isEqualTo(FreeOnboardingStatus.IN_PROGRESS);
  }

  @Test
  @DisplayName("restoreFreeOnboarding: AVAILABLE로 복구하고 연결 정보를 초기화한다")
  void should_restoreFreeOnboarding() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");
    workspace.startFreeOnboarding(10L, OffsetDateTime.parse("2026-06-04T00:00:00Z"));
    workspace.attachFreeOnboardingPipelineJob(10L, 20L);
    workspace.consumeFreeOnboarding(20L, OffsetDateTime.parse("2026-06-04T01:00:00Z"));

    workspace.restoreFreeOnboarding();

    assertThat(workspace.getFreeOnboardingStatus()).isEqualTo(FreeOnboardingStatus.AVAILABLE);
    assertThat(workspace.getFreeOnboardingDatasetId()).isNull();
    assertThat(workspace.getFreeOnboardingPipelineJobId()).isNull();
    assertThat(workspace.getFreeOnboardingStartedAt()).isNull();
    assertThat(workspace.getFreeOnboardingConsumedAt()).isNull();
  }
}
