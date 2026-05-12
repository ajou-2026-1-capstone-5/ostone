package com.init.chatdemo.presentation.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DemoDtoSerializationTest {

  private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

  @Test
  @DisplayName("DTO 직렬화/역직렬화 일치")
  void should_matchContract_when_serializingDemoChatWorkflowResponse() throws Exception {
    DemoChatWorkflowResponse response = chatWorkflowResponse();

    String json = objectMapper.writeValueAsString(response);
    JsonNode root = objectMapper.readTree(json);
    DemoChatWorkflowResponse roundTripped =
        objectMapper.readValue(json, DemoChatWorkflowResponse.class);

    assertThat(root).hasSize(6);
    assertThat(root.has("domainPack")).isTrue();
    assertThat(root.has("workflow")).isTrue();
    assertThat(root.has("chatSession")).isTrue();
    assertThat(root.has("messages")).isTrue();
    assertThat(root.has("execution")).isTrue();
    assertThat(root.has("decisionLogs")).isTrue();
    assertThat(json)
        .contains(
            "\"domainPack\"",
            "\"workflow\"",
            "\"chatSession\"",
            "\"messages\"",
            "\"execution\"",
            "\"decisionLogs\"");
    assertThat(roundTripped).isEqualTo(response);
  }

  @Test
  @DisplayName("도메인 팩 엔드포인트 DTO 직렬화/역직렬화 일치")
  void should_matchContract_when_serializingDomainPackEndpointResponse() throws Exception {
    DemoDomainPackEndpointResponse response =
        new DemoDomainPackEndpointResponse(domainPackResponse(), workflowResponse());

    String json = objectMapper.writeValueAsString(response);
    JsonNode root = objectMapper.readTree(json);
    DemoDomainPackEndpointResponse roundTripped =
        objectMapper.readValue(json, DemoDomainPackEndpointResponse.class);

    assertThat(root).hasSize(2);
    assertThat(root.has("domainPack")).isTrue();
    assertThat(root.has("workflow")).isTrue();
    assertThat(json).contains("\"domainPack\"", "\"workflow\"");
    assertThat(roundTripped).isEqualTo(response);
  }

  @Test
  @DisplayName("채팅 세션 엔드포인트 DTO 직렬화/역직렬화 일치")
  void should_matchContract_when_serializingChatSessionEndpointResponse() throws Exception {
    DemoChatSessionEndpointResponse response =
        new DemoChatSessionEndpointResponse(chatSessionResponse(), messageResponses());

    String json = objectMapper.writeValueAsString(response);
    JsonNode root = objectMapper.readTree(json);
    DemoChatSessionEndpointResponse roundTripped =
        objectMapper.readValue(json, DemoChatSessionEndpointResponse.class);

    assertThat(root).hasSize(2);
    assertThat(root.has("chatSession")).isTrue();
    assertThat(root.has("messages")).isTrue();
    assertThat(json).contains("\"chatSession\"", "\"messages\"");
    assertThat(roundTripped).isEqualTo(response);
  }

  @Test
  @DisplayName("의사결정 로그 엔드포인트 DTO 직렬화/역직렬화 일치")
  void should_matchContract_when_serializingDecisionLogEndpointResponse() throws Exception {
    DemoDecisionLogEndpointResponse response =
        new DemoDecisionLogEndpointResponse(decisionLogResponses());

    String json = objectMapper.writeValueAsString(response);
    JsonNode root = objectMapper.readTree(json);
    DemoDecisionLogEndpointResponse roundTripped =
        objectMapper.readValue(json, DemoDecisionLogEndpointResponse.class);

    assertThat(root).hasSize(1);
    assertThat(root.has("decisionLogs")).isTrue();
    assertThat(json).contains("\"decisionLogs\"");
    assertThat(roundTripped).isEqualTo(response);
  }

  @Test
  @DisplayName("실행 DTO는 슬롯·정책·위험 구조를 유지한다")
  void should_matchContract_when_serializingExecutionResponse() throws Exception {
    DemoExecutionResponse response = executionResponse();

    String json = objectMapper.writeValueAsString(response);
    JsonNode root = objectMapper.readTree(json);
    DemoExecutionResponse roundTripped = objectMapper.readValue(json, DemoExecutionResponse.class);

    assertThat(root).hasSize(9);
    assertThat(root.get("slotValues").get("orderNumber").asText()).isEqualTo("ORD-12345");
    assertThat(root.get("slotValues").get("refundAmount").asInt()).isEqualTo(59000);
    assertThat(root.get("missingSlots").isArray()).isTrue();
    assertThat(root.get("policyHits")).hasSize(1);
    assertThat(root.get("riskHits")).hasSize(1);
    assertThat(json).contains("\"slotValues\"", "\"policyHits\"", "\"riskHits\"");
    assertThat(roundTripped).isEqualTo(response);
  }

  @Test
  @DisplayName("의사결정 로그 DTO는 숫자 타입과 모든 필드를 유지한다")
  void should_matchContract_when_serializingDecisionLogResponse() throws Exception {
    DemoDecisionLogResponse response = decisionLogResponses().getFirst();

    String json = objectMapper.writeValueAsString(response);
    JsonNode root = objectMapper.readTree(json);
    DemoDecisionLogResponse roundTripped =
        objectMapper.readValue(json, DemoDecisionLogResponse.class);

    assertThat(root).hasSize(9);
    assertThat(root.get("step").isInt()).isTrue();
    assertThat(root.get("confidence").isDouble()).isTrue();
    assertThat(json)
        .contains(
            "\"id\"",
            "\"step\"",
            "\"messageId\"",
            "\"eventType\"",
            "\"stateFrom\"",
            "\"stateTo\"",
            "\"decision\"",
            "\"confidence\"",
            "\"reason\"");
    assertThat(roundTripped).isEqualTo(response);
  }

  @Test
  @DisplayName("채팅 세션 DTO는 문자열 시간 필드를 유지한다")
  void should_matchContract_when_serializingChatSessionResponse() throws Exception {
    DemoChatSessionResponse response = chatSessionResponse();

    String json = objectMapper.writeValueAsString(response);
    JsonNode root = objectMapper.readTree(json);
    DemoChatSessionResponse roundTripped =
        objectMapper.readValue(json, DemoChatSessionResponse.class);

    assertThat(root).hasSize(4);
    assertThat(root.get("id").isTextual()).isTrue();
    assertThat(root.get("status").isTextual()).isTrue();
    assertThat(root.get("startedAt").isTextual()).isTrue();
    assertThat(root.get("completedAt").isTextual()).isTrue();
    assertThat(json).contains("\"id\"", "\"status\"", "\"startedAt\"", "\"completedAt\"");
    assertThat(roundTripped).isEqualTo(response);
  }

  private DemoChatWorkflowResponse chatWorkflowResponse() {
    return new DemoChatWorkflowResponse(
        domainPackResponse(),
        workflowResponse(),
        chatSessionResponse(),
        messageResponses(),
        executionResponse(),
        decisionLogResponses());
  }

  private DemoDomainPackResponse domainPackResponse() {
    return new DemoDomainPackResponse(
        "demo-pack-1",
        "CS Support Domain Pack",
        "1.0.0",
        "PUBLISHED",
        List.of(
            new DemoIntentResponse("intent-1", "환불 요청", "고객이 제품 환불을 요청하는 경우"),
            new DemoIntentResponse("intent-2", "배송 조회", "고객이 배송 상태를 문의하는 경우")),
        List.of(new DemoPolicyResponse("policy-1", "환불 가능 기간", "구매일로부터 14일 이내 환불 가능", "HARD")),
        List.of(new DemoRiskResponse("risk-1", "고액 환불", "100만원 이상 환불 요청 시 리뷰 필요", "HIGH")));
  }

  private DemoWorkflowResponse workflowResponse() {
    return new DemoWorkflowResponse(
        "workflow-1",
        "환불 처리 워크플로우",
        "고객 환불 요청을 처리하는 워크플로우",
        List.of(
            "INITIAL",
            "INTENT_DETECTED",
            "SLOT_COLLECTING",
            "POLICY_CHECKING",
            "RISK_CHECKING",
            "DECIDING",
            "COMPLETED",
            "HANDOFF"),
        List.of(
            new DemoTransitionResponse("INITIAL", "INTENT_DETECTED", "INTENT_DETECTED"),
            new DemoTransitionResponse("INTENT_DETECTED", "SLOT_COLLECTING", "SLOT_FILLED"),
            new DemoTransitionResponse("SLOT_COLLECTING", "POLICY_CHECKING", "POLICY_CHECKED"),
            new DemoTransitionResponse("POLICY_CHECKING", "RISK_CHECKING", "RISK_CHECKED"),
            new DemoTransitionResponse("RISK_CHECKING", "DECIDING", "STATE_TRANSITIONED"),
            new DemoTransitionResponse("DECIDING", "COMPLETED", "ANSWER_GENERATED"),
            new DemoTransitionResponse("DECIDING", "HANDOFF", "HANDOFF_TRIGGERED")));
  }

  private DemoChatSessionResponse chatSessionResponse() {
    return new DemoChatSessionResponse(
        "session-1", "completed", "2026-05-10T09:00:00Z", "2026-05-10T09:05:30Z");
  }

  private List<DemoMessageResponse> messageResponses() {
    return List.of(
        new DemoMessageResponse("msg-1", "user", "제품 환불하고 싶습니다", "2026-05-10T09:00:00Z"),
        new DemoMessageResponse(
            "msg-2", "assistant", "네, 환불 도와드리겠습니다. 주문번호를 알려주세요.", "2026-05-10T09:00:15Z"),
        new DemoMessageResponse("msg-3", "user", "주문번호는 ORD-12345입니다", "2026-05-10T09:01:00Z"),
        new DemoMessageResponse(
            "msg-4",
            "assistant",
            "ORD-12345 주문에 대한 환불이 완료되었습니다. 14일 이내에 계좌로 입금됩니다.",
            "2026-05-10T09:05:30Z"));
  }

  private DemoExecutionResponse executionResponse() {
    return new DemoExecutionResponse(
        "exec-1",
        "COMPLETED",
        "COMPLETED",
        "wf-node-final",
        "환불 요청",
        Map.of("orderNumber", "ORD-12345", "refundAmount", 59000),
        List.of(),
        List.of(new DemoPolicyHitResponse("policy-1", "환불 가능 기간", "PASS", "구매일로부터 14일 이내")),
        List.of(new DemoRiskHitResponse("risk-1", "고액 환불", "LOW", "환불 금액 59,000원 — 고액 환불 기준 미만")));
  }

  private List<DemoDecisionLogResponse> decisionLogResponses() {
    return List.of(
        new DemoDecisionLogResponse(
            "log-1",
            1,
            "msg-1",
            "INTENT_DETECTED",
            "INITIAL",
            "INTENT_DETECTED",
            "ALLOW",
            0.95,
            "환불 요청 패턴 감지"),
        new DemoDecisionLogResponse(
            "log-2",
            2,
            "msg-3",
            "SLOT_FILLED",
            "INTENT_DETECTED",
            "SLOT_COLLECTING",
            "ALLOW",
            0.88,
            "주문번호 slot 수집 완료"),
        new DemoDecisionLogResponse(
            "log-3",
            3,
            "msg-3",
            "POLICY_CHECKED",
            "SLOT_COLLECTING",
            "POLICY_CHECKING",
            "ALLOW",
            1.0,
            "환불 가능 기간 정책 통과"),
        new DemoDecisionLogResponse(
            "log-4",
            4,
            "msg-3",
            "RISK_CHECKED",
            "POLICY_CHECKING",
            "RISK_CHECKING",
            "ALLOW",
            0.75,
            "고액 환불 위험 낮음"),
        new DemoDecisionLogResponse(
            "log-5",
            5,
            "msg-4",
            "ANSWER_GENERATED",
            "DECIDING",
            "COMPLETED",
            "ALLOW",
            0.92,
            "환불 완료 안내 생성"));
  }
}
