package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.init.domainpack.application.exception.WorkflowInvalidStartNodeException;
import com.init.domainpack.application.exception.WorkflowUnlabeledBranchException;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("RefundWorkflowGraphValidation")
class RefundWorkflowGraphValidationTest {

  private static final Long WORKFLOW_ID = 153L;
  private static final Long VERSION_ID = 101L;
  private static final String WORKFLOW_CODE = "refund_request_flow";

  private static final String REFUND_REQUEST_GRAPH_JSON =
      """
      {
        "direction": "top-to-bottom",
        "nodes": [
          {"id": "start", "type": "START", "label": "시작"},
          {"id": "n1", "type": "ACTION", "label": "환불 금액 확인", "policyRef": "refund_amount_check"},
          {"id": "n2", "type": "DECISION", "label": "환불 가능?"},
          {"id": "n3", "type": "ACTION", "label": "반품 기한 확인", "policyRef": "return_deadline_check"},
          {"id": "n4", "type": "DECISION", "label": "기한 내?"},
          {"id": "n5", "type": "ACTION", "label": "고액 환불 알림", "policyRef": "high_value_alert"},
          {"id": "end_requested", "type": "TERMINAL", "label": "환불 접수 완료", "state": "refund_requested"},
          {"id": "end_rejected", "type": "TERMINAL", "label": "환불 불가", "state": "rejected"}
        ],
        "edges": [
          {"id": "e1", "from": "start", "to": "n1"},
          {"id": "e2", "from": "n1", "to": "n2"},
          {"id": "e3", "from": "n2", "to": "n3", "label": "가능"},
          {"id": "e4", "from": "n2", "to": "end_rejected", "label": "불가능"},
          {"id": "e5", "from": "n3", "to": "n4"},
          {"id": "e6", "from": "n4", "to": "n5", "label": "기한 내"},
          {"id": "e7", "from": "n4", "to": "end_rejected", "label": "기한 초과"},
          {"id": "e8", "from": "n5", "to": "end_requested"}
        ]
      }
      """;

  @Test
  @DisplayName("환불 워크플로우 graphJson은 V1-V8 검증을 통과한다")
  void should_validateRefundWorkflowGraph_when_graphJsonMatchesSeedData() {
    assertThatNoException()
        .isThrownBy(
            () ->
                WorkflowGraphValidator.parseAndValidate(REFUND_REQUEST_GRAPH_JSON, WORKFLOW_CODE));
  }

  @Test
  @DisplayName("환불 워크플로우 transitions는 8개 edge의 from/to/label/toPolicyRef를 반환한다")
  void should_returnTransitionDetails_when_graphJsonMatchesSeedData() {
    List<WorkflowTransitionDetail> details =
        WorkflowTransitionDetail.listFromGraphJson(
            REFUND_REQUEST_GRAPH_JSON, WORKFLOW_ID, VERSION_ID);

    assertThat(details)
        .hasSize(8)
        .extracting(
            WorkflowTransitionDetail::id,
            WorkflowTransitionDetail::from,
            WorkflowTransitionDetail::to,
            WorkflowTransitionDetail::label,
            WorkflowTransitionDetail::toPolicyRef)
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple("e1", "start", "n1", null, "refund_amount_check"),
            org.assertj.core.groups.Tuple.tuple("e2", "n1", "n2", null, null),
            org.assertj.core.groups.Tuple.tuple("e3", "n2", "n3", "가능", "return_deadline_check"),
            org.assertj.core.groups.Tuple.tuple("e4", "n2", "end_rejected", "불가능", null),
            org.assertj.core.groups.Tuple.tuple("e5", "n3", "n4", null, null),
            org.assertj.core.groups.Tuple.tuple("e6", "n4", "n5", "기한 내", "high_value_alert"),
            org.assertj.core.groups.Tuple.tuple("e7", "n4", "end_rejected", "기한 초과", null),
            org.assertj.core.groups.Tuple.tuple("e8", "n5", "end_requested", null, null));
  }

  @Test
  @DisplayName("invalid node type은 validator가 거부한다")
  void should_rejectGraph_when_nodeTypeIsInvalid() {
    String invalidGraphJson =
        REFUND_REQUEST_GRAPH_JSON.replace("\"type\": \"START\"", "\"type\": \"INVALID_TYPE\"");

    assertThatThrownBy(
            () -> WorkflowGraphValidator.parseAndValidate(invalidGraphJson, WORKFLOW_CODE))
        .isInstanceOf(WorkflowInvalidStartNodeException.class);
  }

  @Test
  @DisplayName("DECISION edge label 누락 시 validator가 거부한다")
  void should_rejectGraph_when_decisionEdgeLabelIsMissing() {
    String invalidGraphJson =
        REFUND_REQUEST_GRAPH_JSON.replace(
            "{\"id\": \"e3\", \"from\": \"n2\", \"to\": \"n3\", \"label\": \"가능\"}",
            "{\"id\": \"e3\", \"from\": \"n2\", \"to\": \"n3\"}");

    assertThatThrownBy(
            () -> WorkflowGraphValidator.parseAndValidate(invalidGraphJson, WORKFLOW_CODE))
        .isInstanceOf(WorkflowUnlabeledBranchException.class);
  }
}
