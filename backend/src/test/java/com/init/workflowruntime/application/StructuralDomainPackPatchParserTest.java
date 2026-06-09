package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.domain.InvalidStructuralPatchException;
import com.init.workflowruntime.domain.StructuralDomainPackPatch;
import com.init.workflowruntime.domain.StructuralPatchOperation;
import com.init.workflowruntime.domain.StructuralPatchOperationType;
import com.init.workflowruntime.domain.StructuralPatchTargetCategory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("StructuralDomainPackPatchParser")
class StructuralDomainPackPatchParserTest {

  private final StructuralDomainPackPatchParser parser =
      new StructuralDomainPackPatchParser(new ObjectMapper());

  // ---- 정상: 봉투(envelope) ----

  @Test
  @DisplayName("parse: 스키마/요약/evidence/operations를 검증된 VO로 변환한다")
  void shouldParseEnvelope() {
    String json =
        envelope(
            "{\"op\":\"MARK_SLOT_REQUIRED\",\"slotCode\":\"pickupDate\",\"reason\":\"예약 전 필수\"}");

    StructuralDomainPackPatch patch = parser.parse(json);

    assertThat(patch.schemaVersion()).isEqualTo(StructuralDomainPackPatch.SCHEMA_VERSION);
    assertThat(patch.summary()).isEqualTo("workflow 보강");
    assertThat(patch.evidence().feedbackId()).isEqualTo(123L);
    assertThat(patch.evidence().simulationSessionId()).isEqualTo(456L);
    assertThat(patch.evidence().goldenCaseId()).isEqualTo(789L);
    assertThat(patch.evidence().replayResultId()).isEqualTo(790L);
    assertThat(patch.evidence().failureSummary())
        .isEqualTo("expected ASK_SLOT but was NEED_INTENT");
    assertThat(patch.operations()).hasSize(1);
  }

  @Test
  @DisplayName("parse: operations는 불변 목록으로 노출된다")
  void shouldExposeImmutableOperations() {
    StructuralDomainPackPatch patch =
        parser.parse(
            envelope(
                "{\"op\":\"MARK_SLOT_REQUIRED\",\"slotCode\":\"pickupDate\",\"reason\":\"필수\"}"));

    assertThatThrownBy(() -> patch.operations().clear())
        .isInstanceOf(UnsupportedOperationException.class);
  }

  // ---- 정상: ELEMENT operation 전체 ----

  @Test
  @DisplayName("parse: UPDATE_INTENT_DESCRIPTION을 intentCode/description으로 파싱한다")
  void shouldParseUpdateIntentDescription() {
    StructuralPatchOperation.ElementAttribute op =
        parseSingleElement(
            "{\"op\":\"UPDATE_INTENT_DESCRIPTION\",\"intentCode\":\"book_pickup\","
                + "\"description\":\"픽업 예약 의도\",\"reason\":\"의미 명확화\"}");

    assertThat(op.type()).isEqualTo(StructuralPatchOperationType.UPDATE_INTENT_DESCRIPTION);
    assertThat(op.category()).isEqualTo(StructuralPatchTargetCategory.INTENT);
    assertThat(op.targetCode()).isEqualTo("book_pickup");
    assertThat(op.value()).isEqualTo("픽업 예약 의도");
    assertThat(op.reason()).isEqualTo("의미 명확화");
  }

  @Test
  @DisplayName("parse: ADD_INTENT_EXAMPLE을 example 값으로 파싱한다")
  void shouldParseAddIntentExample() {
    StructuralPatchOperation.ElementAttribute op =
        parseSingleElement(
            "{\"op\":\"ADD_INTENT_EXAMPLE\",\"intentCode\":\"book_pickup\","
                + "\"example\":\"공항 픽업 예약하고 싶어요\",\"reason\":\"표현 보강\"}");

    assertThat(op.type()).isEqualTo(StructuralPatchOperationType.ADD_INTENT_EXAMPLE);
    assertThat(op.value()).isEqualTo("공항 픽업 예약하고 싶어요");
  }

  @Test
  @DisplayName("parse: UPDATE_SLOT_DESCRIPTION을 slotCode/description으로 파싱한다")
  void shouldParseUpdateSlotDescription() {
    StructuralPatchOperation.ElementAttribute op =
        parseSingleElement(
            "{\"op\":\"UPDATE_SLOT_DESCRIPTION\",\"slotCode\":\"pickupDate\","
                + "\"description\":\"픽업 날짜\",\"reason\":\"설명 보강\"}");

    assertThat(op.category()).isEqualTo(StructuralPatchTargetCategory.SLOT);
    assertThat(op.targetCode()).isEqualTo("pickupDate");
    assertThat(op.value()).isEqualTo("픽업 날짜");
  }

  @Test
  @DisplayName("parse: MARK_SLOT_REQUIRED는 값 없이 slotCode만으로 파싱한다")
  void shouldParseMarkSlotRequired() {
    StructuralPatchOperation.ElementAttribute op =
        parseSingleElement(
            "{\"op\":\"MARK_SLOT_REQUIRED\",\"slotCode\":\"pickupDate\",\"reason\":\"필수\"}");

    assertThat(op.type()).isEqualTo(StructuralPatchOperationType.MARK_SLOT_REQUIRED);
    assertThat(op.value()).isNull();
  }

  @Test
  @DisplayName("parse: UPDATE_SLOT_VALIDATION을 validation 값으로 파싱한다")
  void shouldParseUpdateSlotValidation() {
    StructuralPatchOperation.ElementAttribute op =
        parseSingleElement(
            "{\"op\":\"UPDATE_SLOT_VALIDATION\",\"slotCode\":\"pickupDate\","
                + "\"validation\":\"future_date\",\"reason\":\"미래 날짜만 허용\"}");

    assertThat(op.value()).isEqualTo("future_date");
  }

  @Test
  @DisplayName("parse: UPDATE_POLICY_CONDITION을 policyCode/condition으로 파싱한다")
  void shouldParseUpdatePolicyCondition() {
    StructuralPatchOperation.ElementAttribute op =
        parseSingleElement(
            "{\"op\":\"UPDATE_POLICY_CONDITION\",\"policyCode\":\"refund_window\","
                + "\"condition\":\"days <= 7\",\"reason\":\"환불 기한 명시\"}");

    assertThat(op.category()).isEqualTo(StructuralPatchTargetCategory.POLICY);
    assertThat(op.targetCode()).isEqualTo("refund_window");
    assertThat(op.value()).isEqualTo("days <= 7");
  }

  @Test
  @DisplayName("parse: UPDATE_RISK_TRIGGER을 riskCode/trigger로 파싱한다")
  void shouldParseUpdateRiskTrigger() {
    StructuralPatchOperation.ElementAttribute op =
        parseSingleElement(
            "{\"op\":\"UPDATE_RISK_TRIGGER\",\"riskCode\":\"angry_customer\","
                + "\"trigger\":\"sentiment < -0.5\",\"reason\":\"이관 조건 강화\"}");

    assertThat(op.category()).isEqualTo(StructuralPatchTargetCategory.RISK);
    assertThat(op.value()).isEqualTo("sentiment < -0.5");
  }

  @Test
  @DisplayName("parse: UPDATE_RESPONSE_COPY를 responseCode/copy로 파싱한다")
  void shouldParseUpdateResponseCopy() {
    StructuralPatchOperation.ElementAttribute op =
        parseSingleElement(
            "{\"op\":\"UPDATE_RESPONSE_COPY\",\"responseCode\":\"greeting\","
                + "\"copy\":\"안녕하세요, 무엇을 도와드릴까요?\",\"reason\":\"문구 개선\"}");

    assertThat(op.category()).isEqualTo(StructuralPatchTargetCategory.RESPONSE);
    assertThat(op.targetCode()).isEqualTo("greeting");
    assertThat(op.value()).isEqualTo("안녕하세요, 무엇을 도와드릴까요?");
  }

  @Test
  @DisplayName("parse: ELEMENT operation은 code 없이 targetId로도 식별된다")
  void shouldParseElementByTargetId() {
    StructuralPatchOperation.ElementAttribute op =
        parseSingleElement(
            "{\"op\":\"UPDATE_SLOT_DESCRIPTION\",\"targetId\":42,"
                + "\"description\":\"픽업 날짜\",\"reason\":\"설명 보강\"}");

    assertThat(op.targetCode()).isNull();
    assertThat(op.targetId()).isEqualTo(42L);
  }

  // ---- 정상: WORKFLOW operation 전체 ----

  @Test
  @DisplayName("parse: ADD_WORKFLOW_NODE를 노드 필드와 함께 파싱한다")
  void shouldParseAddWorkflowNode() {
    StructuralPatchOperation.WorkflowNode op =
        parseSingleNode(
            "{\"op\":\"ADD_WORKFLOW_NODE\",\"workflowCode\":\"airport_pickup_flow\","
                + "\"nodeId\":\"ask_pickup_date\",\"nodeType\":\"ASK_SLOT\","
                + "\"slotCode\":\"pickupDate\",\"prompt\":\"픽업 날짜를 알려주세요\",\"reason\":\"날짜 수집\"}");

    assertThat(op.type()).isEqualTo(StructuralPatchOperationType.ADD_WORKFLOW_NODE);
    assertThat(op.workflowCode()).isEqualTo("airport_pickup_flow");
    assertThat(op.nodeId()).isEqualTo("ask_pickup_date");
    assertThat(op.nodeType()).isEqualTo("ASK_SLOT");
    assertThat(op.slotCode()).isEqualTo("pickupDate");
    assertThat(op.prompt()).isEqualTo("픽업 날짜를 알려주세요");
  }

  @Test
  @DisplayName("parse: UPDATE_WORKFLOW_NODE는 workflowDefinitionId와 선택 필드 없이도 파싱한다")
  void shouldParseUpdateWorkflowNodeByDefinitionId() {
    StructuralPatchOperation.WorkflowNode op =
        parseSingleNode(
            "{\"op\":\"UPDATE_WORKFLOW_NODE\",\"workflowDefinitionId\":7,"
                + "\"nodeId\":\"ask_pickup_date\",\"nodeType\":\"ASK_SLOT\",\"reason\":\"프롬프트 수정\"}");

    assertThat(op.workflowCode()).isNull();
    assertThat(op.workflowDefinitionId()).isEqualTo(7L);
    assertThat(op.slotCode()).isNull();
    assertThat(op.prompt()).isNull();
  }

  @Test
  @DisplayName("parse: ADD_TRANSITION을 from/to/condition으로 파싱한다")
  void shouldParseAddTransition() {
    StructuralPatchOperation.WorkflowTransition op =
        parseSingleTransition(
            "{\"op\":\"ADD_TRANSITION\",\"workflowCode\":\"airport_pickup_flow\","
                + "\"from\":\"start\",\"to\":\"ask_pickup_date\","
                + "\"condition\":\"missing(pickupDate)\",\"reason\":\"분기 추가\"}");

    assertThat(op.type()).isEqualTo(StructuralPatchOperationType.ADD_TRANSITION);
    assertThat(op.from()).isEqualTo("start");
    assertThat(op.to()).isEqualTo("ask_pickup_date");
    assertThat(op.condition()).isEqualTo("missing(pickupDate)");
  }

  @Test
  @DisplayName("parse: UPDATE_TRANSITION을 파싱한다")
  void shouldParseUpdateTransition() {
    StructuralPatchOperation.WorkflowTransition op =
        parseSingleTransition(
            "{\"op\":\"UPDATE_TRANSITION\",\"workflowCode\":\"airport_pickup_flow\","
                + "\"from\":\"start\",\"to\":\"ask_pickup_date\",\"reason\":\"조건 변경\"}");

    assertThat(op.type()).isEqualTo(StructuralPatchOperationType.UPDATE_TRANSITION);
    assertThat(op.condition()).isNull();
  }

  @Test
  @DisplayName("parse: REMOVE_TRANSITION은 condition 없이 from/to만으로 파싱한다")
  void shouldParseRemoveTransition() {
    StructuralPatchOperation.WorkflowTransition op =
        parseSingleTransition(
            "{\"op\":\"REMOVE_TRANSITION\",\"workflowCode\":\"airport_pickup_flow\","
                + "\"from\":\"start\",\"to\":\"ask_pickup_date\",\"reason\":\"불필요한 전이 제거\"}");

    assertThat(op.type()).isEqualTo(StructuralPatchOperationType.REMOVE_TRANSITION);
  }

  // ---- 거절: 봉투(envelope) ----

  @Test
  @DisplayName("parse: 비어 있는 문서를 거절한다")
  void shouldRejectBlankDocument() {
    assertThatThrownBy(() -> parser.parse("  "))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("비어 있습니다");
  }

  @Test
  @DisplayName("parse: malformed JSON을 거절한다")
  void shouldRejectMalformedJson() {
    assertThatThrownBy(() -> parser.parse("{not json"))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("JSON으로 파싱할 수 없습니다");
  }

  @Test
  @DisplayName("parse: object가 아닌 문서를 거절한다")
  void shouldRejectNonObjectDocument() {
    assertThatThrownBy(() -> parser.parse("[]"))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("JSON object여야 합니다");
  }

  @Test
  @DisplayName("parse: 인식되지 않는 schemaVersion을 거절한다")
  void shouldRejectUnknownSchemaVersion() {
    String json =
        "{\"schemaVersion\":\"simulation-structural-patch.v2\",\"evidence\":{\"failureSummary\":\"x\"},"
            + "\"operations\":[{\"op\":\"MARK_SLOT_REQUIRED\",\"slotCode\":\"a\",\"reason\":\"r\"}]}";

    assertThatThrownBy(() -> parser.parse(json))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("schemaVersion");
  }

  @Test
  @DisplayName("parse: operations가 배열이 아니면 거절한다")
  void shouldRejectNonArrayOperations() {
    String json =
        "{\"schemaVersion\":\""
            + StructuralDomainPackPatch.SCHEMA_VERSION
            + "\","
            + "\"evidence\":{\"failureSummary\":\"x\"},\"operations\":{}}";

    assertThatThrownBy(() -> parser.parse(json))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("배열이어야 합니다");
  }

  @Test
  @DisplayName("parse: operations가 비어 있으면 거절한다")
  void shouldRejectEmptyOperations() {
    String json =
        "{\"schemaVersion\":\""
            + StructuralDomainPackPatch.SCHEMA_VERSION
            + "\","
            + "\"evidence\":{\"failureSummary\":\"x\"},\"operations\":[]}";

    assertThatThrownBy(() -> parser.parse(json))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("최소 1개");
  }

  @Test
  @DisplayName("parse: evidence가 없으면 거절한다")
  void shouldRejectMissingEvidence() {
    String json =
        "{\"schemaVersion\":\""
            + StructuralDomainPackPatch.SCHEMA_VERSION
            + "\","
            + "\"operations\":[{\"op\":\"MARK_SLOT_REQUIRED\",\"slotCode\":\"a\",\"reason\":\"r\"}]}";

    assertThatThrownBy(() -> parser.parse(json))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("evidence는 필수");
  }

  @Test
  @DisplayName("parse: evidence.failureSummary가 없으면 거절한다")
  void shouldRejectMissingFailureSummary() {
    String json =
        "{\"schemaVersion\":\""
            + StructuralDomainPackPatch.SCHEMA_VERSION
            + "\","
            + "\"evidence\":{\"feedbackId\":1},"
            + "\"operations\":[{\"op\":\"MARK_SLOT_REQUIRED\",\"slotCode\":\"a\",\"reason\":\"r\"}]}";

    assertThatThrownBy(() -> parser.parse(json))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("failureSummary");
  }

  @Test
  @DisplayName("parse: 정수가 아닌 evidence id를 거절한다")
  void shouldRejectNonIntegerEvidenceId() {
    String json =
        "{\"schemaVersion\":\""
            + StructuralDomainPackPatch.SCHEMA_VERSION
            + "\","
            + "\"evidence\":{\"feedbackId\":\"oops\",\"failureSummary\":\"x\"},"
            + "\"operations\":[{\"op\":\"MARK_SLOT_REQUIRED\",\"slotCode\":\"a\",\"reason\":\"r\"}]}";

    assertThatThrownBy(() -> parser.parse(json))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("정수여야 합니다");
  }

  // ---- 거절: operation ----

  @Test
  @DisplayName("parse: 지원하지 않는 operation을 fail-closed로 거절한다")
  void shouldRejectUnsupportedOperation() {
    assertThatThrownBy(
            () -> parser.parse(envelope("{\"op\":\"DELETE_EVERYTHING\",\"reason\":\"r\"}")))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("지원하지 않는 operation");
  }

  @Test
  @DisplayName("parse: reason이 없으면 거절한다")
  void shouldRejectMissingReason() {
    assertThatThrownBy(
            () -> parser.parse(envelope("{\"op\":\"MARK_SLOT_REQUIRED\",\"slotCode\":\"a\"}")))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("reason");
  }

  @Test
  @DisplayName("parse: ELEMENT operation에 code/targetId가 모두 없으면 거절한다")
  void shouldRejectElementWithoutTarget() {
    assertThatThrownBy(
            () ->
                parser.parse(
                    envelope(
                        "{\"op\":\"UPDATE_SLOT_DESCRIPTION\",\"description\":\"x\",\"reason\":\"r\"}")))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("slotCode 또는 targetId");
  }

  @Test
  @DisplayName("parse: value가 필요한 ELEMENT operation에 값이 없으면 거절한다")
  void shouldRejectElementWithoutValue() {
    assertThatThrownBy(
            () ->
                parser.parse(
                    envelope(
                        "{\"op\":\"UPDATE_INTENT_DESCRIPTION\",\"intentCode\":\"a\",\"reason\":\"r\"}")))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("description 값이 필요");
  }

  @Test
  @DisplayName("parse: workflow operation에 workflow 식별자가 없으면 거절한다")
  void shouldRejectWorkflowWithoutTarget() {
    assertThatThrownBy(
            () ->
                parser.parse(
                    envelope(
                        "{\"op\":\"ADD_WORKFLOW_NODE\",\"nodeId\":\"n\",\"nodeType\":\"ASK_SLOT\",\"reason\":\"r\"}")))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("workflowCode 또는 workflowDefinitionId");
  }

  @Test
  @DisplayName("parse: workflow node operation에 nodeId가 없으면 거절한다")
  void shouldRejectWorkflowNodeWithoutNodeId() {
    assertThatThrownBy(
            () ->
                parser.parse(
                    envelope(
                        "{\"op\":\"ADD_WORKFLOW_NODE\",\"workflowCode\":\"w\",\"nodeType\":\"ASK_SLOT\",\"reason\":\"r\"}")))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("nodeId");
  }

  @Test
  @DisplayName("parse: workflow node operation에 nodeType이 없으면 거절한다")
  void shouldRejectWorkflowNodeWithoutNodeType() {
    assertThatThrownBy(
            () ->
                parser.parse(
                    envelope(
                        "{\"op\":\"ADD_WORKFLOW_NODE\",\"workflowCode\":\"w\",\"nodeId\":\"n\",\"reason\":\"r\"}")))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("nodeType");
  }

  @Test
  @DisplayName("parse: transition operation에 from/to가 없으면 거절한다")
  void shouldRejectTransitionWithoutEndpoints() {
    assertThatThrownBy(
            () ->
                parser.parse(
                    envelope(
                        "{\"op\":\"ADD_TRANSITION\",\"workflowCode\":\"w\",\"to\":\"b\",\"reason\":\"r\"}")))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("from");
  }

  // ---- helpers ----

  private StructuralPatchOperation.ElementAttribute parseSingleElement(String operationJson) {
    return (StructuralPatchOperation.ElementAttribute) parseSingle(operationJson);
  }

  private StructuralPatchOperation.WorkflowNode parseSingleNode(String operationJson) {
    return (StructuralPatchOperation.WorkflowNode) parseSingle(operationJson);
  }

  private StructuralPatchOperation.WorkflowTransition parseSingleTransition(String operationJson) {
    return (StructuralPatchOperation.WorkflowTransition) parseSingle(operationJson);
  }

  private StructuralPatchOperation parseSingle(String operationJson) {
    StructuralDomainPackPatch patch = parser.parse(envelope(operationJson));
    return patch.operations().get(0);
  }

  private static String envelope(String operationJson) {
    return "{\"schemaVersion\":\""
        + StructuralDomainPackPatch.SCHEMA_VERSION
        + "\",\"summary\":\"workflow 보강\","
        + "\"evidence\":{\"feedbackId\":123,\"simulationSessionId\":456,\"goldenCaseId\":789,"
        + "\"replayResultId\":790,\"failureSummary\":\"expected ASK_SLOT but was NEED_INTENT\"},"
        + "\"operations\":["
        + operationJson
        + "]}";
  }
}
