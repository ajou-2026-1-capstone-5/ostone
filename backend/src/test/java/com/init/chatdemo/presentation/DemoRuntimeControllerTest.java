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

  @Autowired private MockMvc mockMvc;

  @MockitoBean private DemoRuntimeMockService service;

  @Test
  @DisplayName("GET /api/v1/demo/chat-workflow → 200, 6개 섹션 JSON 검증")
  @WithLongPrincipal(10L)
  void should_200_when_getChatWorkflow() throws Exception {
    given(service.getChatWorkflow()).willReturn(chatWorkflowResponse());

    mockMvc
        .perform(get("/api/v1/demo/chat-workflow").accept(MediaType.APPLICATION_JSON))
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
  @DisplayName("GET /api/v1/demo/domain-pack → 200, domainPack와 workflow JSON 검증")
  @WithLongPrincipal(10L)
  void should_200_when_getDomainPack() throws Exception {
    given(service.getDomainPack()).willReturn(domainPackEndpointResponse());

    mockMvc
        .perform(get("/api/v1/demo/domain-pack").accept(MediaType.APPLICATION_JSON))
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
        .andExpect(jsonPath("$.workflow.name").value("배송 문의 처리"))
        .andExpect(jsonPath("$.workflow.description").value("배송 문의를 확인하고 정책과 위험을 점검합니다."))
        .andExpect(jsonPath("$.workflow.states").isArray())
        .andExpect(jsonPath("$.workflow.transitions").isArray());
  }

  @Test
  @DisplayName("GET /api/v1/demo/chat-sessions/{sessionId} → 200, chatSession과 messages JSON 검증")
  @WithLongPrincipal(10L)
  void should_200_when_getChatSession() throws Exception {
    given(service.getChatSession("session-1")).willReturn(chatSessionEndpointResponse());

    mockMvc
        .perform(get("/api/v1/demo/chat-sessions/session-1").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.chatSession.id").value("session-1"))
        .andExpect(jsonPath("$.chatSession.status").value("completed"))
        .andExpect(jsonPath("$.chatSession.startedAt").value("2026-05-10T09:00:00Z"))
        .andExpect(jsonPath("$.chatSession.completedAt").value("2026-05-10T09:05:30Z"))
        .andExpect(jsonPath("$.messages").isArray())
        .andExpect(jsonPath("$.messages[0].id").value("message-1"))
        .andExpect(jsonPath("$.messages[0].role").value("customer"))
        .andExpect(jsonPath("$.messages[0].content").value("배송 상태를 알고 싶어요."))
        .andExpect(jsonPath("$.messages[0].timestamp").value("2026-05-10T09:00:10Z"));
  }

  @Test
  @DisplayName("GET /api/v1/demo/chat-sessions/unknown-id → 404")
  @WithLongPrincipal(10L)
  void should_404_when_getUnknownChatSession() throws Exception {
    given(service.getChatSession("unknown-id"))
        .willThrow(new NotFoundException("DEMO_CHAT_SESSION_NOT_FOUND", "Chat session not found"));

    mockMvc
        .perform(get("/api/v1/demo/chat-sessions/unknown-id").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.code").value("DEMO_CHAT_SESSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET /api/v1/demo/workflow-executions/{executionId} → 200, execution 상세 JSON 검증")
  @WithLongPrincipal(10L)
  void should_200_when_getWorkflowExecution() throws Exception {
    given(service.getWorkflowExecution("exec-1")).willReturn(executionResponse());

    mockMvc
        .perform(get("/api/v1/demo/workflow-executions/exec-1").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.id").value("exec-1"))
        .andExpect(jsonPath("$.status").value("completed"))
        .andExpect(jsonPath("$.currentState").value("resolved"))
        .andExpect(jsonPath("$.currentNodeId").value("node-3"))
        .andExpect(jsonPath("$.intent").value("delivery_status"))
        .andExpect(jsonPath("$.slotValues").isMap())
        .andExpect(jsonPath("$.slotValues.orderId").value("ORD-2026-001"))
        .andExpect(jsonPath("$.missingSlots").isArray())
        .andExpect(jsonPath("$.policyHits").isArray())
        .andExpect(jsonPath("$.policyHits[0].policyId").value("policy-1"))
        .andExpect(jsonPath("$.policyHits[0].policyName").value("배송 조회 정책"))
        .andExpect(jsonPath("$.policyHits[0].result").value("pass"))
        .andExpect(jsonPath("$.policyHits[0].detail").value("주문번호로 배송 조회 가능"))
        .andExpect(jsonPath("$.riskHits").isArray())
        .andExpect(jsonPath("$.riskHits[0].riskId").value("risk-1"))
        .andExpect(jsonPath("$.riskHits[0].riskName").value("개인정보 노출"))
        .andExpect(jsonPath("$.riskHits[0].result").value("safe"))
        .andExpect(jsonPath("$.riskHits[0].detail").value("민감 정보 노출 없음"));
  }

  @Test
  @DisplayName("GET /api/v1/demo/workflow-executions/unknown-id → 404")
  @WithLongPrincipal(10L)
  void should_404_when_getUnknownWorkflowExecution() throws Exception {
    given(service.getWorkflowExecution("unknown-id"))
        .willThrow(
            new NotFoundException("DEMO_WORKFLOW_EXECUTION_NOT_FOUND", "Execution not found"));

    mockMvc
        .perform(
            get("/api/v1/demo/workflow-executions/unknown-id").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.code").value("DEMO_WORKFLOW_EXECUTION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET /api/v1/demo/decision-logs?executionId=exec-1 → 200, decisionLogs JSON 검증")
  @WithLongPrincipal(10L)
  void should_200_when_getDecisionLogs() throws Exception {
    given(service.getDecisionLogs("exec-1")).willReturn(decisionLogEndpointResponse());

    mockMvc
        .perform(get("/api/v1/demo/decision-logs").queryParam("executionId", "exec-1"))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.decisionLogs").isArray())
        .andExpect(jsonPath("$.decisionLogs[0].id").value("log-1"))
        .andExpect(jsonPath("$.decisionLogs[0].step").value(1))
        .andExpect(jsonPath("$.decisionLogs[0].messageId").value("message-1"))
        .andExpect(jsonPath("$.decisionLogs[0].eventType").value("intent_detected"))
        .andExpect(jsonPath("$.decisionLogs[0].stateFrom").value("start"))
        .andExpect(jsonPath("$.decisionLogs[0].stateTo").value("slot_filling"))
        .andExpect(jsonPath("$.decisionLogs[0].decision").value("배송 조회 의도 감지"))
        .andExpect(jsonPath("$.decisionLogs[0].confidence").value(0.92))
        .andExpect(jsonPath("$.decisionLogs[0].reason").value("배송 상태 문의 표현이 포함됨"));
  }

  @Test
  @DisplayName("GET /api/v1/demo/decision-logs executionId 누락 → 400")
  @WithLongPrincipal(10L)
  void should_400_when_missingExecutionId() throws Exception {
    mockMvc
        .perform(get("/api/v1/demo/decision-logs").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isBadRequest());
  }

  @Test
  @DisplayName("GET /api/v1/demo/decision-logs?executionId=unknown → 404")
  @WithLongPrincipal(10L)
  void should_404_when_getUnknownDecisionLogs() throws Exception {
    given(service.getDecisionLogs("unknown"))
        .willThrow(
            new NotFoundException("DEMO_DECISION_LOGS_NOT_FOUND", "Decision logs not found"));

    mockMvc
        .perform(get("/api/v1/demo/decision-logs").queryParam("executionId", "unknown"))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.code").value("DEMO_DECISION_LOGS_NOT_FOUND"));
  }

  @Test
  @DisplayName("인증 없이 요청 시 401 반환")
  void should_401_when_unauthenticated() throws Exception {
    mockMvc
        .perform(get("/api/v1/demo/chat-workflow").accept(MediaType.APPLICATION_JSON))
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
        List.of(new DemoIntentResponse("intent-1", "delivery_status", "배송 상태 확인")),
        List.of(new DemoPolicyResponse("policy-1", "배송 조회 정책", "주문번호로 배송 조회", "medium")),
        List.of(new DemoRiskResponse("risk-1", "개인정보 노출", "민감 정보 노출 여부", "low")));
  }

  private DemoWorkflowResponse workflowResponse() {
    return new DemoWorkflowResponse(
        "workflow-1",
        "배송 문의 처리",
        "배송 문의를 확인하고 정책과 위험을 점검합니다.",
        List.of("start", "slot_filling", "resolved"),
        List.of(new DemoTransitionResponse("start", "slot_filling", "intent_detected")));
  }

  private DemoChatSessionResponse sessionResponse() {
    return new DemoChatSessionResponse(
        "session-1", "completed", "2026-05-10T09:00:00Z", "2026-05-10T09:05:30Z");
  }

  private List<DemoMessageResponse> messageResponses() {
    return List.of(
        new DemoMessageResponse("message-1", "customer", "배송 상태를 알고 싶어요.", "2026-05-10T09:00:10Z"));
  }

  private DemoExecutionResponse executionResponse() {
    return new DemoExecutionResponse(
        "exec-1",
        "completed",
        "resolved",
        "node-3",
        "delivery_status",
        Map.of("orderId", "ORD-2026-001"),
        List.of(),
        List.of(new DemoPolicyHitResponse("policy-1", "배송 조회 정책", "pass", "주문번호로 배송 조회 가능")),
        List.of(new DemoRiskHitResponse("risk-1", "개인정보 노출", "safe", "민감 정보 노출 없음")));
  }

  private List<DemoDecisionLogResponse> decisionLogResponses() {
    return List.of(
        new DemoDecisionLogResponse(
            "log-1",
            1,
            "message-1",
            "intent_detected",
            "start",
            "slot_filling",
            "배송 조회 의도 감지",
            0.92,
            "배송 상태 문의 표현이 포함됨"));
  }
}
