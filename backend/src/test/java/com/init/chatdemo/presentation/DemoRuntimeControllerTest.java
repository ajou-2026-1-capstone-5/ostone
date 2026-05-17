package com.init.chatdemo.presentation;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.chatdemo.application.DemoRuntimeMockService;
import com.init.chatdemo.presentation.dto.DemoChatSessionEndpointResponse;
import com.init.chatdemo.presentation.dto.DemoChatSessionResponse;
import com.init.chatdemo.presentation.dto.DemoChatWorkflowResponse;
import com.init.chatdemo.presentation.dto.DemoDecisionLogEndpointResponse;
import com.init.chatdemo.presentation.dto.DemoDecisionLogResponse;
import com.init.chatdemo.presentation.dto.DemoDomainPackEndpointResponse;
import com.init.chatdemo.presentation.dto.DemoDomainPackResponse;
import com.init.chatdemo.presentation.dto.DemoExecutionResponse;
import com.init.chatdemo.presentation.dto.DemoIntentResponse;
import com.init.chatdemo.presentation.dto.DemoMessageResponse;
import com.init.chatdemo.presentation.dto.DemoPolicyHitResponse;
import com.init.chatdemo.presentation.dto.DemoPolicyResponse;
import com.init.chatdemo.presentation.dto.DemoRiskHitResponse;
import com.init.chatdemo.presentation.dto.DemoRiskResponse;
import com.init.chatdemo.presentation.dto.DemoTransitionResponse;
import com.init.chatdemo.presentation.dto.DemoWorkflowResponse;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.application.exception.NotFoundException;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = DemoRuntimeController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("DemoRuntimeController")
class DemoRuntimeControllerTest {

  private static final String DEMO_URL_PREFIX = "/api/v1/workspaces/10/demo";

  @Autowired private MockMvc mockMvc;

  @MockitoBean private DemoRuntimeMockService service;

  @Test
  @DisplayName("GET /api/v1/demo/chat-workflow → 200, 6개 섹션 JSON 검증")
  @WithLongPrincipal(10L)
  void should_200_when_getChatWorkflow() throws Exception {
    given(service.getChatWorkflow(10L)).willReturn(chatWorkflowResponse());

    mockMvc
        .perform(get(DEMO_URL_PREFIX + "/chat-workflow").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.domainPack").exists())
        .andExpect(jsonPath("$.workflow").exists())
        .andExpect(jsonPath("$.chatSession").exists())
        .andExpect(jsonPath("$.messages").isArray())
        .andExpect(jsonPath("$.execution").exists())
        .andExpect(jsonPath("$.decisionLogs").isArray());
  }

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/demo/domain-pack → 200, domainPack와 workflow JSON 검증")
  @WithLongPrincipal(10L)
  void should_200_when_getDomainPack() throws Exception {
    given(service.getDomainPack(10L)).willReturn(domainPackEndpointResponse());

    mockMvc
        .perform(get(DEMO_URL_PREFIX + "/domain-pack").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.domainPack.id").value("demo-pack-1"))
        .andExpect(jsonPath("$.domainPack.name").value("CS Support Domain Pack"))
        .andExpect(jsonPath("$.domainPack.version").value("1.0.0"))
        .andExpect(jsonPath("$.domainPack.status").value("PUBLISHED"))
        .andExpect(jsonPath("$.domainPack.intents").isArray())
        .andExpect(jsonPath("$.domainPack.policies").isArray())
        .andExpect(jsonPath("$.domainPack.risks").isArray())
        .andExpect(jsonPath("$.workflow.id").value("workflow-1"))
        .andExpect(jsonPath("$.workflow.name").value("환불 처리 워크플로우"))
        .andExpect(jsonPath("$.workflow.description").value("고객 환불 요청을 처리하는 워크플로우"))
        .andExpect(jsonPath("$.workflow.states").isArray())
        .andExpect(jsonPath("$.workflow.transitions").isArray());
  }

  @Test
  @DisplayName("GET /api/v1/demo/chat-sessions/{sessionId} → 200, chatSession과 messages JSON 검증")
  @WithLongPrincipal(10L)
  void should_200_when_getChatSession() throws Exception {
    given(service.getChatSession(10L, "session-1")).willReturn(chatSessionEndpointResponse());

    mockMvc
        .perform(get(DEMO_URL_PREFIX + "/chat-sessions/session-1").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.chatSession.id").value("session-1"))
        .andExpect(jsonPath("$.chatSession.status").value("completed"))
        .andExpect(jsonPath("$.chatSession.startedAt").value("2026-05-10T09:00:00Z"))
        .andExpect(jsonPath("$.chatSession.completedAt").value("2026-05-10T09:05:30Z"))
        .andExpect(jsonPath("$.messages").isArray())
        .andExpect(jsonPath("$.messages[0].id").value("msg-1"))
        .andExpect(jsonPath("$.messages[0].role").value("user"))
        .andExpect(jsonPath("$.messages[0].content").value("제품 환불하고 싶습니다"))
        .andExpect(jsonPath("$.messages[0].timestamp").value("2026-05-10T09:00:00Z"))
        .andExpect(jsonPath("$.messages[3].id").value("msg-4"))
        .andExpect(jsonPath("$.messages[3].role").value("assistant"));
  }

  @Test
  @DisplayName("GET /api/v1/demo/chat-sessions/unknown-id → 404")
  @WithLongPrincipal(10L)
  void should_404_when_getUnknownChatSession() throws Exception {
    given(service.getChatSession(10L, "unknown-id"))
        .willThrow(new NotFoundException("DEMO_CHAT_SESSION_NOT_FOUND", "Chat session not found"));

    mockMvc
        .perform(get(DEMO_URL_PREFIX + "/chat-sessions/unknown-id").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.code").value("DEMO_CHAT_SESSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET /api/v1/demo/workflow-executions/{executionId} → 200, execution 상세 JSON 검증")
  @WithLongPrincipal(10L)
  void should_200_when_getWorkflowExecution() throws Exception {
    given(service.getWorkflowExecution(10L, "exec-1")).willReturn(executionResponse());

    mockMvc
        .perform(get(DEMO_URL_PREFIX + "/workflow-executions/exec-1").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.id").value("exec-1"))
        .andExpect(jsonPath("$.status").value("COMPLETED"))
        .andExpect(jsonPath("$.currentState").value("COMPLETED"))
        .andExpect(jsonPath("$.currentNodeId").value("wf-node-final"))
        .andExpect(jsonPath("$.intent").value("환불 요청"))
        .andExpect(jsonPath("$.slotValues").isMap())
        .andExpect(jsonPath("$.slotValues.orderNumber").value("ORD-12345"))
        .andExpect(jsonPath("$.slotValues.refundAmount").value(59000))
        .andExpect(jsonPath("$.missingSlots").isArray())
        .andExpect(jsonPath("$.policyHits").isArray())
        .andExpect(jsonPath("$.policyHits[0].policyId").value("policy-1"))
        .andExpect(jsonPath("$.policyHits[0].policyName").value("환불 가능 기간"))
        .andExpect(jsonPath("$.policyHits[0].result").value("PASS"))
        .andExpect(jsonPath("$.policyHits[0].detail").value("구매일로부터 14일 이내"))
        .andExpect(jsonPath("$.riskHits").isArray())
        .andExpect(jsonPath("$.riskHits[0].riskId").value("risk-1"))
        .andExpect(jsonPath("$.riskHits[0].riskName").value("고액 환불"))
        .andExpect(jsonPath("$.riskHits[0].result").value("LOW"))
        .andExpect(jsonPath("$.riskHits[0].detail").value("환불 금액 59,000원 — 고액 환불 기준 미만"));
  }

  @Test
  @DisplayName("GET /api/v1/demo/workflow-executions/unknown-id → 404")
  @WithLongPrincipal(10L)
  void should_404_when_getUnknownWorkflowExecution() throws Exception {
    given(service.getWorkflowExecution(10L, "unknown-id"))
        .willThrow(
            new NotFoundException("DEMO_WORKFLOW_EXECUTION_NOT_FOUND", "Execution not found"));

    mockMvc
        .perform(
            get(DEMO_URL_PREFIX + "/workflow-executions/unknown-id").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.code").value("DEMO_WORKFLOW_EXECUTION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET /api/v1/demo/decision-logs?executionId=exec-1 → 200, decisionLogs JSON 검증")
  @WithLongPrincipal(10L)
  void should_200_when_getDecisionLogs() throws Exception {
    given(service.getDecisionLogs(10L, "exec-1")).willReturn(decisionLogEndpointResponse());

    mockMvc
        .perform(get(DEMO_URL_PREFIX + "/decision-logs").queryParam("executionId", "exec-1"))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.decisionLogs").isArray())
        .andExpect(jsonPath("$.decisionLogs[0].id").value("log-1"))
        .andExpect(jsonPath("$.decisionLogs[0].step").value(1))
        .andExpect(jsonPath("$.decisionLogs[0].messageId").value("msg-1"))
        .andExpect(jsonPath("$.decisionLogs[0].eventType").value("INTENT_DETECTED"))
        .andExpect(jsonPath("$.decisionLogs[0].stateFrom").value("INITIAL"))
        .andExpect(jsonPath("$.decisionLogs[0].stateTo").value("INTENT_DETECTED"))
        .andExpect(jsonPath("$.decisionLogs[0].decision").value("ALLOW"))
        .andExpect(jsonPath("$.decisionLogs[0].confidence").value(0.95))
        .andExpect(jsonPath("$.decisionLogs[0].reason").value("환불 요청 패턴 감지"))
        .andExpect(jsonPath("$.decisionLogs[4].eventType").value("ANSWER_GENERATED"));
  }

  @Test
  @DisplayName("GET /api/v1/demo/decision-logs executionId 누락 → 400")
  @WithLongPrincipal(10L)
  void should_400_when_missingExecutionId() throws Exception {
    mockMvc
        .perform(get(DEMO_URL_PREFIX + "/decision-logs").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isBadRequest());
  }

  @Test
  @DisplayName("GET /api/v1/demo/decision-logs?executionId=unknown → 404")
  @WithLongPrincipal(10L)
  void should_404_when_getUnknownDecisionLogs() throws Exception {
    given(service.getDecisionLogs(10L, "unknown"))
        .willThrow(
            new NotFoundException("DEMO_DECISION_LOGS_NOT_FOUND", "Decision logs not found"));

    mockMvc
        .perform(get(DEMO_URL_PREFIX + "/decision-logs").queryParam("executionId", "unknown"))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.code").value("DEMO_DECISION_LOGS_NOT_FOUND"));
  }

  @Test
  @DisplayName("인증 없이 요청 시 401 반환")
  void should_401_when_unauthenticated() throws Exception {
    mockMvc
        .perform(get(DEMO_URL_PREFIX + "/chat-workflow").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isUnauthorized());
  }

  private DemoChatWorkflowResponse chatWorkflowResponse() {
    return new DemoChatWorkflowResponse(
        domainPackResponse(),
        workflowResponse(),
        sessionResponse(),
        messageResponses(),
        executionResponse(),
        decisionLogResponses());
  }

  private DemoDomainPackEndpointResponse domainPackEndpointResponse() {
    return new DemoDomainPackEndpointResponse(domainPackResponse(), workflowResponse());
  }

  private DemoChatSessionEndpointResponse chatSessionEndpointResponse() {
    return new DemoChatSessionEndpointResponse(sessionResponse(), messageResponses());
  }

  private DemoDecisionLogEndpointResponse decisionLogEndpointResponse() {
    return new DemoDecisionLogEndpointResponse(decisionLogResponses());
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

  private DemoChatSessionResponse sessionResponse() {
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
