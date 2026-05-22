package com.init.workflowruntime.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

import com.init.shared.application.exception.BadRequestException;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

@DisplayName("WorkflowExecution")
class WorkflowExecutionTest {

  @Test
  @DisplayName("create: 실행 기본값을 초기화한다")
  void should_initializeDefaults_when_create() {
    WorkflowExecution execution = WorkflowExecution.create(1L);

    assertThat(execution.getChatSessionId()).isEqualTo(1L);
    assertThat(execution.getWorkflowDefinitionId()).isNull();
    assertThat(execution.getIntentDefinitionId()).isNull();
    assertThat(execution.getStatus()).isEqualTo(WorkflowExecution.STATUS_RUNNING);
    assertThat(execution.getCurrentState()).isNull();
    assertThat(execution.getSlotValuesJson()).isEqualTo("{}");
    assertThat(execution.getPolicySnapshotJson()).isEqualTo("{}");
    assertThat(execution.getRiskSnapshotJson()).isEqualTo("{}");
    assertThat(execution.getFinishedAt()).isNull();
  }

  @Test
  @DisplayName("create: chatSessionId가 null이면 예외")
  void should_throw_when_chatSessionIdIsNull() {
    assertThatNullPointerException().isThrownBy(() -> WorkflowExecution.create(null));
  }

  @Test
  @DisplayName("onPersist: startedAt이 없을 때만 시작 시각을 채운다")
  void should_setStartedAtOnlyWhenMissing_when_onPersist() {
    WorkflowExecution execution = WorkflowExecution.create(1L);

    execution.onPersist();
    OffsetDateTime firstStartedAt = execution.getStartedAt();

    execution.onPersist();

    assertThat(firstStartedAt).isNotNull();
    assertThat(execution.getStartedAt()).isEqualTo(firstStartedAt);
  }

  @Test
  @DisplayName("replaceSlotValuesJson: null은 빈 JSON object로 저장한다")
  void should_replaceSlotValuesWithEmptyJson_when_valueIsNull() {
    WorkflowExecution execution = WorkflowExecution.create(1L);
    ReflectionTestUtils.setField(execution, "id", 10L);

    execution.replaceSlotValuesJson(null);

    assertThat(execution.getId()).isEqualTo(10L);
    assertThat(execution.getSlotValuesJson()).isEqualTo("{}");
  }

  @Test
  @DisplayName("replacePolicySnapshotJson: null은 빈 JSON object로 저장한다")
  void replacesPolicySnapshotWithEmptyJsonWhenValueIsNull() {
    WorkflowExecution execution = WorkflowExecution.create(1L);

    execution.replacePolicySnapshotJson(null);

    assertThat(execution.getPolicySnapshotJson()).isEqualTo("{}");
  }

  @Test
  @DisplayName("replaceRiskSnapshotJson: null은 빈 JSON object로 저장한다")
  void replacesRiskSnapshotWithEmptyJsonWhenValueIsNull() {
    WorkflowExecution execution = WorkflowExecution.create(1L);

    execution.replaceRiskSnapshotJson(null);

    assertThat(execution.getRiskSnapshotJson()).isEqualTo("{}");
  }

  @Test
  @DisplayName("assignIntentWorkflow: 실행 중이면 intent/workflow/currentState를 저장한다")
  void should_assignIntentWorkflow_when_running() {
    WorkflowExecution execution = WorkflowExecution.create(1L);

    execution.assignIntentWorkflow(10L, 20L, "start");

    assertThat(execution.getIntentDefinitionId()).isEqualTo(10L);
    assertThat(execution.getWorkflowDefinitionId()).isEqualTo(20L);
    assertThat(execution.getCurrentState()).isEqualTo("start");
    assertThat(execution.getStatus()).isEqualTo(WorkflowExecution.STATUS_RUNNING);
  }

  @Test
  @DisplayName("moveToState: 실행 중이면 currentState를 변경한다")
  void movesToStateWhenRunning() {
    WorkflowExecution execution = WorkflowExecution.create(1L);
    execution.assignIntentWorkflow(10L, 20L, "start");

    execution.moveToState("confirm");

    assertThat(execution.getCurrentState()).isEqualTo("confirm");
  }

  @Test
  @DisplayName("moveToState: 완료된 실행이면 currentState를 변경하지 않는다")
  void throwsWhenMovingCompletedExecution() {
    WorkflowExecution execution = WorkflowExecution.create(1L);
    execution.assignIntentWorkflow(10L, 20L, "start");
    execution.complete();

    assertThatExceptionOfType(BadRequestException.class)
        .isThrownBy(() -> execution.moveToState("confirm"))
        .withMessageContaining("terminal execution");

    assertThat(execution.getCurrentState()).isEqualTo("start");
  }

  @Test
  @DisplayName("moveToState: 공백 state는 허용하지 않는다")
  void throwsWhenMovingToBlankState() {
    WorkflowExecution execution = WorkflowExecution.create(1L);
    execution.assignIntentWorkflow(10L, 20L, "start");

    assertThatExceptionOfType(BadRequestException.class)
        .isThrownBy(() -> execution.moveToState(" "))
        .withMessageContaining("nextState must not be blank");

    assertThat(execution.getCurrentState()).isEqualTo("start");
  }

  @Test
  @DisplayName("complete: 실행 중이면 완료 상태와 종료 시각을 저장한다")
  void completesExecutionWhenRunning() {
    WorkflowExecution execution = WorkflowExecution.create(1L);

    execution.complete();

    assertThat(execution.getStatus()).isEqualTo(WorkflowExecution.STATUS_COMPLETED);
    assertThat(execution.getFinishedAt()).isNotNull();
  }

  @Test
  @DisplayName("complete: 이미 완료된 실행이면 상태를 유지한다")
  void keepsCompletedExecutionWhenAlreadyCompleted() {
    WorkflowExecution execution = WorkflowExecution.create(1L);
    execution.complete();
    OffsetDateTime firstFinishedAt = execution.getFinishedAt();

    execution.complete();

    assertThat(execution.getStatus()).isEqualTo(WorkflowExecution.STATUS_COMPLETED);
    assertThat(execution.getFinishedAt()).isEqualTo(firstFinishedAt);
  }

  @Test
  @DisplayName("complete: 실패한 실행이면 완료로 변경하지 않는다")
  void throwsWhenCompletingFailedExecution() {
    WorkflowExecution execution = WorkflowExecution.create(1L);
    ReflectionTestUtils.setField(execution, "status", WorkflowExecution.STATUS_FAILED);

    assertThatExceptionOfType(BadRequestException.class)
        .isThrownBy(execution::complete)
        .withMessageContaining("Cannot complete failed execution");

    assertThat(execution.getStatus()).isEqualTo(WorkflowExecution.STATUS_FAILED);
    assertThat(execution.getFinishedAt()).isNull();
  }

  @Test
  @DisplayName("assignIntentWorkflow: 완료된 실행이면 재할당하지 않는다")
  void should_throw_when_assigningCompletedExecution() {
    WorkflowExecution execution = WorkflowExecution.create(1L);
    ReflectionTestUtils.setField(execution, "status", WorkflowExecution.STATUS_COMPLETED);

    assertThatExceptionOfType(BadRequestException.class)
        .isThrownBy(() -> execution.assignIntentWorkflow(10L, 20L, "start"))
        .withMessageContaining("terminal execution");

    assertThat(execution.getIntentDefinitionId()).isNull();
    assertThat(execution.getWorkflowDefinitionId()).isNull();
    assertThat(execution.getCurrentState()).isNull();
    assertThat(execution.getStatus()).isEqualTo(WorkflowExecution.STATUS_COMPLETED);
  }

  @Test
  @DisplayName("assignIntentWorkflow: 실패한 실행이면 재할당하지 않는다")
  void should_throw_when_assigningFailedExecution() {
    WorkflowExecution execution = WorkflowExecution.create(1L);
    ReflectionTestUtils.setField(execution, "status", WorkflowExecution.STATUS_FAILED);

    assertThatExceptionOfType(BadRequestException.class)
        .isThrownBy(() -> execution.assignIntentWorkflow(10L, 20L, "start"))
        .withMessageContaining("terminal execution");

    assertThat(execution.getStatus()).isEqualTo(WorkflowExecution.STATUS_FAILED);
  }
}
