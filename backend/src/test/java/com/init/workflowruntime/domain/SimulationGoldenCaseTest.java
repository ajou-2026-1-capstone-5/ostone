package com.init.workflowruntime.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("SimulationGoldenCase 도메인")
class SimulationGoldenCaseTest {

  @Test
  @DisplayName("검증 케이스 생성 시 이름과 JSON 기본값을 정규화한다")
  void create_normalizesNameAndJsonDefaults() {
    SimulationGoldenCase goldenCase =
        SimulationGoldenCase.create(1L, 10L, 101L, " 환불 검증 ", "", null, 7L);

    assertThat(goldenCase.getWorkspaceId()).isEqualTo(1L);
    assertThat(goldenCase.getSourceChatSessionId()).isEqualTo(10L);
    assertThat(goldenCase.getSourceDomainPackVersionId()).isEqualTo(101L);
    assertThat(goldenCase.getName()).isEqualTo("환불 검증");
    assertThat(goldenCase.getInputMessagesJson()).isEqualTo("[]");
    assertThat(goldenCase.getExpectedJson()).isEqualTo("{}");
    assertThat(goldenCase.getCreatedBy()).isEqualTo(7L);
    assertThat(goldenCase.getCreatedAt()).isNull();
    assertThat(goldenCase.getUpdatedAt()).isNull();

    goldenCase.onPersist();
    assertThat(goldenCase.getCreatedAt()).isNotNull();
    assertThat(goldenCase.getUpdatedAt()).isNotNull();

    goldenCase.onUpdate();
    assertThat(goldenCase.getUpdatedAt()).isNotNull();
  }

  @Test
  @DisplayName("검증 케이스 생성 값이 유효하지 않으면 거부한다")
  void create_invalidValues_throws() {
    assertThatThrownBy(() -> SimulationGoldenCase.create(null, 10L, 101L, "검증", "[]", "{}", 7L))
        .isInstanceOf(InvalidSimulationGoldenCaseException.class)
        .hasMessageContaining("workspaceId");

    assertThatThrownBy(() -> SimulationGoldenCase.create(1L, 10L, 101L, " ", "[]", "{}", 7L))
        .isInstanceOf(InvalidSimulationGoldenCaseException.class)
        .hasMessageContaining("name must not be blank");

    assertThatThrownBy(
            () -> SimulationGoldenCase.create(1L, 10L, 101L, "a".repeat(256), "[]", "{}", 7L))
        .isInstanceOf(InvalidSimulationGoldenCaseException.class)
        .hasMessageContaining("name must be at most 255");
  }

  @Test
  @DisplayName("replay 결과 생성 시 JSON 기본값과 실패 요약을 정규화한다")
  void replayResultRecord_normalizesJsonDefaultsAndFailureSummary() {
    SimulationGoldenCaseReplayResult result =
        SimulationGoldenCaseReplayResult.record(
            1L,
            950L,
            101L,
            960L,
            SimulationGoldenCaseReplayStatus.FAIL,
            "",
            null,
            " state mismatch ",
            7L);

    assertThat(result.getWorkspaceId()).isEqualTo(1L);
    assertThat(result.getGoldenCaseId()).isEqualTo(950L);
    assertThat(result.getDomainPackVersionId()).isEqualTo(101L);
    assertThat(result.getReplayChatSessionId()).isEqualTo(960L);
    assertThat(result.getStatus()).isEqualTo(SimulationGoldenCaseReplayStatus.FAIL);
    assertThat(result.getExpectedJson()).isEqualTo("{}");
    assertThat(result.getActualJson()).isEqualTo("{}");
    assertThat(result.getFailureSummary()).isEqualTo("state mismatch");
    assertThat(result.getCreatedBy()).isEqualTo(7L);
    assertThat(result.getCreatedAt()).isNull();

    result.onPersist();
    assertThat(result.getCreatedAt()).isNotNull();
  }

  @Test
  @DisplayName("replay 결과 실패 요약이 blank이면 저장하지 않는다")
  void replayResultRecord_blankFailureSummary_usesNull() {
    SimulationGoldenCaseReplayResult result =
        SimulationGoldenCaseReplayResult.record(
            1L, 950L, 101L, 960L, SimulationGoldenCaseReplayStatus.PASS, "{}", "{}", " ", 7L);

    assertThat(result.getFailureSummary()).isNull();
  }

  @Test
  @DisplayName("replay 결과 생성 값이 유효하지 않으면 거부한다")
  void replayResultRecord_invalidValues_throws() {
    assertThatThrownBy(
            () ->
                SimulationGoldenCaseReplayResult.record(
                    null,
                    950L,
                    101L,
                    960L,
                    SimulationGoldenCaseReplayStatus.PASS,
                    "{}",
                    "{}",
                    null,
                    7L))
        .isInstanceOf(InvalidSimulationGoldenCaseException.class)
        .hasMessageContaining("workspaceId");

    assertThatThrownBy(
            () ->
                SimulationGoldenCaseReplayResult.record(
                    1L, 950L, 101L, 960L, null, "{}", "{}", null, 7L))
        .isInstanceOf(InvalidSimulationGoldenCaseException.class)
        .hasMessageContaining("status must not be null");
  }
}
