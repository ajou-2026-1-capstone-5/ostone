package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.shared.application.exception.InternalException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("WorkflowRuntimeGraph")
class WorkflowRuntimeGraphTest {

  @Test
  @DisplayName("parse: graphJson이 null이면 InternalException으로 래핑한다")
  void wrapsNullGraphJsonWithInternalException() {
    assertThatExceptionOfType(InternalException.class)
        .isThrownBy(() -> WorkflowRuntimeGraph.parse(new ObjectMapper(), null, 150L))
        .satisfies(
            ex ->
                assertThat(((InternalException) ex).getCode())
                    .isEqualTo("WORKFLOW_GRAPH_PARSE_FAILED"));
  }
}
