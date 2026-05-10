package com.init.chatdemo.domain;

import com.init.chatdemo.presentation.dto.DemoChatSessionResponse;
import com.init.chatdemo.presentation.dto.DemoChatWorkflowResponse;
import com.init.chatdemo.presentation.dto.DemoDecisionLogResponse;
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
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DemoRuntimeFixture {

  private static final DemoDomainPackResponse DOMAIN_PACK =
      new DemoDomainPackResponse(
          "demo-pack-1",
          "CS Support Domain Pack",
          "1.0.0",
          "PUBLISHED",
          List.of(new DemoIntentResponse("intent-1", "delivery_status", "배송 상태 확인")),
          List.of(new DemoPolicyResponse("policy-1", "배송 조회 정책", "주문번호로 배송 조회", "medium")),
          List.of(new DemoRiskResponse("risk-1", "개인정보 노출", "민감 정보 노출 여부", "low")));
  private static final DemoWorkflowResponse WORKFLOW =
      new DemoWorkflowResponse(
          "workflow-1",
          "배송 문의 처리",
          "배송 문의를 확인하고 정책과 위험을 점검합니다.",
          List.of("start", "slot_filling", "resolved"),
          List.of(new DemoTransitionResponse("start", "slot_filling", "intent_detected")));
  private static final DemoChatSessionResponse CHAT_SESSION =
      new DemoChatSessionResponse(
          "session-1", "completed", "2026-05-10T09:00:00Z", "2026-05-10T09:05:30Z");
  private static final List<DemoMessageResponse> MESSAGES =
      List.of(
          new DemoMessageResponse(
              "message-1", "customer", "배송 상태를 알고 싶어요.", "2026-05-10T09:00:10Z"));
  private static final DemoExecutionResponse EXECUTION =
      new DemoExecutionResponse(
          "exec-1",
          "completed",
          "resolved",
          "node-3",
          "delivery_status",
          Map.of("orderId", "ORD-2026-001"),
          List.of(),
          List.of(new DemoPolicyHitResponse("policy-1", "배송 조회 정책", "pass", "주문번호로 배송 조회 가능")),
          List.of(new DemoRiskHitResponse("risk-1", "개인정보 노출", "safe", "민감 정보 노출 없음")));
  private static final List<DemoDecisionLogResponse> DECISION_LOGS =
      List.of(
          new DemoDecisionLogResponse(
              "log-1",
              1,
              "message-1",
              "INTENT_DETECTED",
              "start",
              "slot_filling",
              "ALLOW",
              0.92,
              "배송 상태 문의 표현이 포함됨"));
  private static final DemoChatWorkflowResponse CHAT_WORKFLOW =
      new DemoChatWorkflowResponse(
          DOMAIN_PACK, WORKFLOW, CHAT_SESSION, MESSAGES, EXECUTION, DECISION_LOGS);

  public DemoChatWorkflowResponse provideChatWorkflow() {
    return CHAT_WORKFLOW;
  }

  public DemoChatSessionResponse findSession(String sessionId) {
    if (CHAT_SESSION.id().equals(sessionId)) {
      return CHAT_SESSION;
    }
    return null;
  }

  public List<DemoMessageResponse> findSessionMessages(String sessionId) {
    if (CHAT_SESSION.id().equals(sessionId)) {
      return MESSAGES;
    }
    return List.of();
  }

  public DemoExecutionResponse findExecution(String executionId) {
    if (EXECUTION.id().equals(executionId)) {
      return EXECUTION;
    }
    return null;
  }

  public List<DemoDecisionLogResponse> findDecisionLogs(String executionId) {
    if (EXECUTION.id().equals(executionId)) {
      return DECISION_LOGS;
    }
    return List.of();
  }
}
