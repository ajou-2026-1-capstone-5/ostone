package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.application.dto.NormalizedPatchOperationView;
import com.init.workflowruntime.domain.SimulationPatchValidationStatus;
import com.init.workflowruntime.domain.StructuralDomainPackPatch;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

@DisplayName("SimulationCandidatePatchViewMapper")
class SimulationCandidatePatchViewMapperTest {

  private static final String SCHEMA_V1 = StructuralDomainPackPatch.SCHEMA_VERSION;
  private static final String FAILURE_SUMMARY = "expected ASK_SLOT but got NEED_INTENT";

  private final ObjectMapper objectMapper = new ObjectMapper();
  private final SimulationCandidatePatchViewMapper mapper =
      new SimulationCandidatePatchViewMapper(
          new StructuralDomainPackPatchParser(objectMapper), objectMapper);

  // ---- NONE: 빈 패치 ----

  @ParameterizedTest(name = "[{index}] ''{0}'' → NONE")
  @NullAndEmptySource
  @ValueSource(strings = {"{}", "[]", "null", "   "})
  @DisplayName("map: 빈/blank/null/빈 object/배열 → NONE 반환, operations 비어있음")
  void returnsNoneForEmptyPatches(String input) {
    var view = mapper.map(input);

    assertThat(view.validationStatus()).isEqualTo(SimulationPatchValidationStatus.NONE);
    assertThat(view.operations()).isEmpty();
    assertThat(view.errors()).isEmpty();
    assertThat(view.schemaVersion()).isNull();
    assertThat(view.summary()).isNull();
  }

  // ---- LEGACY: 구버전 schemaVersion ----

  @Test
  @DisplayName(
      "map: schemaVersion=simulation-candidate-draft-patch.v1 → LEGACY 반환, operations 비어있음")
  void returnsLegacyForLegacySchemaVersion() {
    String json =
        """
        {
          "schemaVersion": "simulation-candidate-draft-patch.v1",
          "operation": "UPDATE_DESCRIPTION",
          "summary": "슬롯 설명 보강"
        }
        """;

    var view = mapper.map(json);

    assertThat(view.validationStatus()).isEqualTo(SimulationPatchValidationStatus.LEGACY);
    assertThat(view.schemaVersion()).isEqualTo("simulation-candidate-draft-patch.v1");
    assertThat(view.operations()).isEmpty();
    assertThat(view.errors()).isEmpty();
  }

  @Test
  @DisplayName("map: LEGACY 패치에 summary 필드가 있으면 summary를 추출한다")
  void extractsSummaryFromLegacyPatch() {
    String json =
        """
        {
          "schemaVersion": "simulation-candidate-draft-patch.v1",
          "summary": "레거시 패치 요약"
        }
        """;

    var view = mapper.map(json);

    assertThat(view.validationStatus()).isEqualTo(SimulationPatchValidationStatus.LEGACY);
    assertThat(view.summary()).isEqualTo("레거시 패치 요약");
  }

  @Test
  @DisplayName("map: LEGACY 패치에 summary 필드가 없으면 summary는 null이다")
  void returnsNullSummaryWhenLegacyPatchHasNoSummary() {
    String json =
        """
        {
          "schemaVersion": "simulation-candidate-draft-patch.v1"
        }
        """;

    var view = mapper.map(json);

    assertThat(view.validationStatus()).isEqualTo(SimulationPatchValidationStatus.LEGACY);
    assertThat(view.summary()).isNull();
  }

  // ---- VALID: 구조적 패치 v1 ----

  @Test
  @DisplayName(
      "map: 유효한 simulation-structural-patch.v1 → VALID, schemaVersion·summary·operations 채워짐")
  void returnsValidForWellFormedStructuralPatch() {
    String json = structuralPatch(slotRequiredOp("order_number"));

    var view = mapper.map(json);

    assertThat(view.validationStatus()).isEqualTo(SimulationPatchValidationStatus.VALID);
    assertThat(view.schemaVersion()).isEqualTo(SCHEMA_V1);
    assertThat(view.summary()).isEqualTo("workflow 보강");
    assertThat(view.errors()).isEmpty();
    assertThat(view.operations()).hasSize(1);
  }

  @Test
  @DisplayName("map: VALID 패치에 여러 operations가 있으면 모두 정규화된다")
  void normalizesMultipleOperations() {
    String json =
        structuralPatchWithOps(
            slotRequiredOp("order_number"),
            """
            {"op":"UPDATE_POLICY_CONDITION","policyCode":"refund_window",
             "condition":"days <= 7","reason":"환불 기한 명시"}
            """);

    var view = mapper.map(json);

    assertThat(view.validationStatus()).isEqualTo(SimulationPatchValidationStatus.VALID);
    assertThat(view.operations()).hasSize(2);
  }

  // ---- INVALID: 파싱 불가 또는 스키마 오류 ----

  @Test
  @DisplayName("map: 깨진 JSON → INVALID, errors에 사유 포함")
  void returnsInvalidForMalformedJson() {
    var view = mapper.map("{not valid json");

    assertThat(view.validationStatus()).isEqualTo(SimulationPatchValidationStatus.INVALID);
    assertThat(view.errors()).isNotEmpty();
    assertThat(view.operations()).isEmpty();
  }

  @Test
  @DisplayName("map: schemaVersion 누락된 비-빈 object → INVALID (parser가 schemaVersion 불일치로 거부)")
  void returnsInvalidWhenSchemaVersionMissing() {
    String json =
        """
        {
          "evidence": {"failureSummary": "missing slot"},
          "operations": [{"op": "MARK_SLOT_REQUIRED", "slotCode": "a", "reason": "r"}]
        }
        """;

    var view = mapper.map(json);

    assertThat(view.validationStatus()).isEqualTo(SimulationPatchValidationStatus.INVALID);
    assertThat(view.errors()).isNotEmpty();
  }

  @Test
  @DisplayName("map: 미상 schemaVersion(simulation-structural-patch-generation.v1) → INVALID")
  void returnsInvalidForUnknownSchemaVersion() {
    String json =
        """
        {
          "schemaVersion": "simulation-structural-patch-generation.v1",
          "status": "INVALID_OUTPUT",
          "summary": "생성 실패"
        }
        """;

    var view = mapper.map(json);

    assertThat(view.validationStatus()).isEqualTo(SimulationPatchValidationStatus.INVALID);
    assertThat(view.errors()).isNotEmpty();
  }

  @Test
  @DisplayName("map: JSON object이지만 배열 최상위 → INVALID")
  void returnsInvalidForNonObjectRoot() {
    // "[]"는 NONE이 아닌 INVALID를 반환한다 — 단, isEmptyPatch가 먼저 처리하므로
    // object가 아닌 다른 구조(숫자 배열)로 검증
    String json = "[1, 2, 3]";

    var view = mapper.map(json);

    // "[]"는 NONE이지만, 비어있지 않은 배열은 isEmptyPatch를 통과 후 object 검증에서 INVALID
    assertThat(view.validationStatus()).isEqualTo(SimulationPatchValidationStatus.INVALID);
    assertThat(view.errors()).isNotEmpty();
  }

  @Test
  @DisplayName("map: evidence.failureSummary 누락 → INVALID")
  void returnsInvalidWhenFailureSummaryMissing() {
    String json =
        """
        {
          "schemaVersion": "%s",
          "evidence": {"feedbackId": 1},
          "operations": [{"op": "MARK_SLOT_REQUIRED", "slotCode": "a", "reason": "r"}]
        }
        """
            .formatted(SCHEMA_V1);

    var view = mapper.map(json);

    assertThat(view.validationStatus()).isEqualTo(SimulationPatchValidationStatus.INVALID);
    assertThat(view.errors()).isNotEmpty();
  }

  @Test
  @DisplayName("map: 지원하지 않는 operation → INVALID")
  void returnsInvalidForUnsupportedOperation() {
    String json = structuralPatch("{\"op\":\"DELETE_EVERYTHING\",\"reason\":\"r\"}");

    var view = mapper.map(json);

    assertThat(view.validationStatus()).isEqualTo(SimulationPatchValidationStatus.INVALID);
    assertThat(view.errors()).isNotEmpty();
  }

  // ---- op별 정규화 결과: targetComplete 및 필드 매핑 ----

  @Test
  @DisplayName(
      "MARK_SLOT_REQUIRED(ElementAttribute, slotCode 있음) → targetComplete=true, SLOT category")
  void normalizesMarkSlotRequiredWithTargetComplete() {
    String json = structuralPatch(slotRequiredOp("order_number"));

    NormalizedPatchOperationView op = firstOp(mapper.map(json));

    assertThat(op.operationType()).isEqualTo("MARK_SLOT_REQUIRED");
    assertThat(op.kind()).isEqualTo("ELEMENT");
    assertThat(op.targetCategory()).isEqualTo("SLOT");
    assertThat(op.targetCode()).isEqualTo("order_number");
    assertThat(op.targetComplete()).isTrue();
    // 값이 필요 없는 op → value null
    assertThat(op.value()).isNull();
  }

  @Test
  @DisplayName(
      "UPDATE_POLICY_CONDITION(ElementAttribute, policyCode+condition) → targetComplete=true")
  void normalizesPolicyConditionWithTargetComplete() {
    String json =
        structuralPatch(
            """
            {"op":"UPDATE_POLICY_CONDITION","policyCode":"refund_window",
             "condition":"days <= 7","reason":"환불 기한 명시"}
            """);

    NormalizedPatchOperationView op = firstOp(mapper.map(json));

    assertThat(op.operationType()).isEqualTo("UPDATE_POLICY_CONDITION");
    assertThat(op.targetCategory()).isEqualTo("POLICY");
    assertThat(op.targetCode()).isEqualTo("refund_window");
    assertThat(op.value()).isEqualTo("days <= 7");
    assertThat(op.targetComplete()).isTrue();
  }

  @Test
  @DisplayName(
      "UPDATE_RESPONSE_COPY(ElementAttribute, responseCode) → targetComplete=true, RESPONSE category")
  void normalizesResponseCopyWithTargetComplete() {
    String json =
        structuralPatch(
            """
            {"op":"UPDATE_RESPONSE_COPY","responseCode":"greeting",
             "copy":"안녕하세요, 무엇을 도와드릴까요?","reason":"문구 개선"}
            """);

    NormalizedPatchOperationView op = firstOp(mapper.map(json));

    assertThat(op.operationType()).isEqualTo("UPDATE_RESPONSE_COPY");
    assertThat(op.targetCategory()).isEqualTo("RESPONSE");
    assertThat(op.targetCode()).isEqualTo("greeting");
    assertThat(op.value()).isEqualTo("안녕하세요, 무엇을 도와드릴까요?");
    assertThat(op.targetComplete()).isTrue();
  }

  @Test
  @DisplayName(
      "ADD_WORKFLOW_NODE(WorkflowNode, nodeId 있음) → targetComplete=true, nodeId/nodeType/prompt 매핑")
  void normalizesAddWorkflowNodeWithTargetComplete() {
    String json =
        structuralPatch(
            """
            {"op":"ADD_WORKFLOW_NODE","workflowCode":"airport_pickup_flow",
             "nodeId":"ask_pickup_date","nodeType":"ASK_SLOT",
             "slotCode":"pickupDate","prompt":"픽업 날짜를 알려주세요","reason":"날짜 수집"}
            """);

    NormalizedPatchOperationView op = firstOp(mapper.map(json));

    assertThat(op.operationType()).isEqualTo("ADD_WORKFLOW_NODE");
    assertThat(op.kind()).isEqualTo("WORKFLOW_NODE");
    assertThat(op.targetCategory()).isEqualTo("WORKFLOW");
    assertThat(op.targetCode()).isEqualTo("airport_pickup_flow");
    assertThat(op.nodeId()).isEqualTo("ask_pickup_date");
    assertThat(op.nodeType()).isEqualTo("ASK_SLOT");
    assertThat(op.slotCode()).isEqualTo("pickupDate");
    assertThat(op.prompt()).isEqualTo("픽업 날짜를 알려주세요");
    assertThat(op.targetComplete()).isTrue();
  }

  @Test
  @DisplayName(
      "UPDATE_TRANSITION(WorkflowTransition, from/to 있음) → targetComplete=true, from/to/condition 매핑")
  void normalizesUpdateTransitionWithTargetComplete() {
    String json =
        structuralPatch(
            """
            {"op":"UPDATE_TRANSITION","workflowCode":"airport_pickup_flow",
             "from":"start","to":"ask_pickup_date",
             "condition":"missing(pickupDate)","reason":"조건 변경"}
            """);

    NormalizedPatchOperationView op = firstOp(mapper.map(json));

    assertThat(op.operationType()).isEqualTo("UPDATE_TRANSITION");
    assertThat(op.kind()).isEqualTo("WORKFLOW_TRANSITION");
    assertThat(op.targetCategory()).isEqualTo("WORKFLOW");
    assertThat(op.from()).isEqualTo("start");
    assertThat(op.to()).isEqualTo("ask_pickup_date");
    assertThat(op.condition()).isEqualTo("missing(pickupDate)");
    assertThat(op.targetComplete()).isTrue();
  }

  @Test
  @DisplayName("WorkflowNode: workflowDefinitionId만으로 식별 시 targetComplete=true")
  void normalizesWorkflowNodeByDefinitionIdWithTargetComplete() {
    String json =
        structuralPatch(
            """
            {"op":"UPDATE_WORKFLOW_NODE","workflowDefinitionId":7,
             "nodeId":"ask_pickup_date","nodeType":"ASK_SLOT","reason":"프롬프트 수정"}
            """);

    NormalizedPatchOperationView op = firstOp(mapper.map(json));

    // workflowCode는 null이지만 workflowDefinitionId 있으므로 targetComplete=true
    assertThat(op.targetCode()).isNull();
    assertThat(op.targetId()).isNull(); // WorkflowNode는 targetId 미노출 (workflowDefinitionId 별도)
    assertThat(op.targetComplete()).isTrue();
  }

  @Test
  @DisplayName("targetComplete=false는 parser 통과 후 구성될 수 없다 — parser가 식별자 없는 op를 거부하므로")
  void targetCompleteCannotBeFalseAfterParserValidation() {
    // ElementAttribute: targetCode/targetId 모두 없으면 parser가 InvalidStructuralPatchException 발생
    // WorkflowNode: workflowCode/workflowDefinitionId 없으면 거부, nodeId/nodeType 없으면 거부
    // WorkflowTransition: from/to 없으면 거부
    // 따라서 parser를 통과한 VALID 패치는 항상 targetComplete=true를 보장한다.
    // 아래는 parser 거부를 확인하는 회귀 보호 케이스다.

    // ELEMENT: code/targetId 모두 없음
    String jsonElementNoTarget =
        structuralPatch(
            "{\"op\":\"UPDATE_SLOT_DESCRIPTION\",\"description\":\"x\",\"reason\":\"r\"}");
    assertThat(mapper.map(jsonElementNoTarget).validationStatus())
        .isEqualTo(SimulationPatchValidationStatus.INVALID);

    // WorkflowNode: nodeId 없음
    String jsonNodeNoId =
        structuralPatch(
            "{\"op\":\"ADD_WORKFLOW_NODE\",\"workflowCode\":\"w\",\"nodeType\":\"ASK_SLOT\",\"reason\":\"r\"}");
    assertThat(mapper.map(jsonNodeNoId).validationStatus())
        .isEqualTo(SimulationPatchValidationStatus.INVALID);

    // WorkflowTransition: to 없음
    String jsonTransitionNoTo =
        structuralPatch(
            "{\"op\":\"ADD_TRANSITION\",\"workflowCode\":\"w\",\"from\":\"a\",\"reason\":\"r\"}");
    assertThat(mapper.map(jsonTransitionNoTo).validationStatus())
        .isEqualTo(SimulationPatchValidationStatus.INVALID);
  }

  @Test
  @DisplayName("NormalizedPatchOperationView.from은 모든 StructuralPatchOperationType enum 분기를 커버한다")
  void fromCoverAllOperationTypeKinds() {
    // ELEMENT kind
    var elementJson = structuralPatch(slotRequiredOp("s1"));
    assertThat(firstOp(mapper.map(elementJson)).kind()).isEqualTo("ELEMENT");

    // WORKFLOW_NODE kind
    var nodeJson =
        structuralPatch(
            "{\"op\":\"ADD_WORKFLOW_NODE\",\"workflowCode\":\"w\","
                + "\"nodeId\":\"n\",\"nodeType\":\"ASK_SLOT\",\"reason\":\"r\"}");
    assertThat(firstOp(mapper.map(nodeJson)).kind()).isEqualTo("WORKFLOW_NODE");

    // WORKFLOW_TRANSITION kind
    var transitionJson =
        structuralPatch(
            "{\"op\":\"ADD_TRANSITION\",\"workflowCode\":\"w\","
                + "\"from\":\"a\",\"to\":\"b\",\"reason\":\"r\"}");
    assertThat(firstOp(mapper.map(transitionJson)).kind()).isEqualTo("WORKFLOW_TRANSITION");
  }

  // ---- helpers ----

  private NormalizedPatchOperationView firstOp(SimulationCandidatePatchViewMapper.PatchView view) {
    assertThat(view.operations()).isNotEmpty();
    return view.operations().get(0);
  }

  private static String slotRequiredOp(String slotCode) {
    return "{\"op\":\"MARK_SLOT_REQUIRED\",\"slotCode\":\"%s\",\"reason\":\"필수\"}"
        .formatted(slotCode);
  }

  private static String structuralPatch(String operationJson) {
    return structuralPatchWithOps(operationJson);
  }

  private static String structuralPatchWithOps(String... operationJsons) {
    String ops = String.join(",", operationJsons);
    return """
        {
          "schemaVersion": "%s",
          "summary": "workflow 보강",
          "evidence": {
            "feedbackId": 123,
            "simulationSessionId": 456,
            "failureSummary": "%s"
          },
          "operations": [%s]
        }
        """
        .formatted(SCHEMA_V1, FAILURE_SUMMARY, ops);
  }
}
