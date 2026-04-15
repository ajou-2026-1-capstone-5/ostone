package com.init.domainpack.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("WorkflowDefinition.updateGraph()")
class WorkflowDefinitionUpdateGraphTest {

  private static final String VALID_GRAPH =
      "{\"direction\":\"LR\",\"nodes\":[{\"id\":\"start\",\"type\":\"START\"},{\"id\":\"end\",\"type\":\"TERMINAL\"}],"
          + "\"edges\":[{\"from\":\"start\",\"to\":\"end\",\"label\":null}]}";

  private WorkflowDefinition workflow;

  @BeforeEach
  void setUp() {
    workflow =
        WorkflowDefinition.create(
            1L, "wf_refund", "환불 워크플로우", "설명", VALID_GRAPH, "start", "[\"end\"]", "[]", "{}");
  }

  @Test
  @DisplayName("유효한 인자로 호출 시 name, description, graphJson, initialState, terminalStatesJson이 수정된다")
  void should_필드수정_when_유효한인자() {
    String newGraph =
        "{\"direction\":\"LR\",\"nodes\":[{\"id\":\"s\",\"type\":\"START\"},{\"id\":\"e\",\"type\":\"TERMINAL\"}],"
            + "\"edges\":[{\"from\":\"s\",\"to\":\"e\",\"label\":null}]}";

    workflow.updateGraph("새 이름", "새 설명", newGraph, "s", "[\"e\"]");

    assertThat(workflow.getName()).isEqualTo("새 이름");
    assertThat(workflow.getDescription()).isEqualTo("새 설명");
    assertThat(workflow.getGraphJson()).isEqualTo(newGraph);
    assertThat(workflow.getInitialState()).isEqualTo("s");
    assertThat(workflow.getTerminalStatesJson()).isEqualTo("[\"e\"]");
  }

  @Test
  @DisplayName("description이 null이면 null로 수정된다")
  void should_descriptionNull_when_nullPassed() {
    workflow.updateGraph("이름", null, VALID_GRAPH, "start", "[\"end\"]");

    assertThat(workflow.getDescription()).isNull();
  }

  @Test
  @DisplayName("name이 blank이면 IllegalArgumentException")
  void should_예외_when_nameBlank() {
    assertThatThrownBy(() -> workflow.updateGraph("  ", null, VALID_GRAPH, "start", "[\"end\"]"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("blank");
  }

  @Test
  @DisplayName("name이 null이면 NullPointerException")
  void should_예외_when_nameNull() {
    assertThatThrownBy(() -> workflow.updateGraph(null, null, VALID_GRAPH, "start", "[\"end\"]"))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  @DisplayName("graphJson이 null이면 NullPointerException")
  void should_예외_when_graphJsonNull() {
    assertThatThrownBy(() -> workflow.updateGraph("이름", null, null, "start", "[\"end\"]"))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  @DisplayName("terminalStatesJson이 null이면 NullPointerException")
  void should_예외_when_terminalStatesJsonNull() {
    assertThatThrownBy(() -> workflow.updateGraph("이름", null, VALID_GRAPH, "start", null))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  @DisplayName("workflowCode, domainPackVersionId는 수정되지 않는다")
  void should_불변필드유지_when_updateGraph() {
    workflow.updateGraph("새 이름", "새 설명", VALID_GRAPH, "start", "[\"end\"]");

    assertThat(workflow.getWorkflowCode()).isEqualTo("wf_refund");
    assertThat(workflow.getDomainPackVersionId()).isEqualTo(1L);
  }
}
