package com.init.chatdemo.application;

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

  private static final String STATE_INITIAL = "INITIAL";
  private static final String STATE_INTENT_DETECTED = "INTENT_DETECTED";
  private static final String STATE_SLOT_COLLECTING = "SLOT_COLLECTING";
  private static final String STATE_POLICY_CHECKING = "POLICY_CHECKING";
  private static final String STATE_RISK_CHECKING = "RISK_CHECKING";
  private static final String STATE_DECIDING = "DECIDING";
  private static final String STATE_COMPLETED = "COMPLETED";
  private static final String DECISION_ALLOW = "ALLOW";
  private static final String MESSAGE_WITH_ORDER_NUMBER = "msg-3";

  private static final DemoDomainPackResponse DOMAIN_PACK =
      new DemoDomainPackResponse(
          "demo-pack-1",
          "CS Support Domain Pack",
          "1.0.0",
          "PUBLISHED",
          List.of(
              new DemoIntentResponse("intent-1", "환불 요청", "고객이 제품 환불을 요청하는 경우"),
              new DemoIntentResponse("intent-2", "배송 조회", "고객이 배송 상태를 문의하는 경우")),
          List.of(new DemoPolicyResponse("policy-1", "환불 가능 기간", "구매일로부터 14일 이내 환불 가능", "HARD")),
          List.of(new DemoRiskResponse("risk-1", "고액 환불", "100만원 이상 환불 요청 시 리뷰 필요", "HIGH")));
  private static final DemoWorkflowResponse WORKFLOW =
      new DemoWorkflowResponse(
          "workflow-1",
          "환불 처리 워크플로우",
          "고객 환불 요청을 처리하는 워크플로우",
          List.of(
              STATE_INITIAL,
              STATE_INTENT_DETECTED,
              STATE_SLOT_COLLECTING,
              STATE_POLICY_CHECKING,
              STATE_RISK_CHECKING,
              STATE_DECIDING,
              STATE_COMPLETED,
              "HANDOFF"),
          List.of(
              new DemoTransitionResponse(
                  STATE_INITIAL, STATE_INTENT_DETECTED, STATE_INTENT_DETECTED),
              new DemoTransitionResponse(
                  STATE_INTENT_DETECTED, STATE_SLOT_COLLECTING, "SLOT_FILLED"),
              new DemoTransitionResponse(
                  STATE_SLOT_COLLECTING, STATE_POLICY_CHECKING, "POLICY_CHECKED"),
              new DemoTransitionResponse(
                  STATE_POLICY_CHECKING, STATE_RISK_CHECKING, "RISK_CHECKED"),
              new DemoTransitionResponse(STATE_RISK_CHECKING, STATE_DECIDING, "STATE_TRANSITIONED"),
              new DemoTransitionResponse(STATE_DECIDING, STATE_COMPLETED, "ANSWER_GENERATED"),
              new DemoTransitionResponse(STATE_DECIDING, "HANDOFF", "HANDOFF_TRIGGERED")));
  private static final DemoChatSessionResponse CHAT_SESSION =
      new DemoChatSessionResponse(
          "session-1", "completed", "2026-05-10T09:00:00Z", "2026-05-10T09:05:30Z");
  private static final List<DemoMessageResponse> MESSAGES =
      List.of(
          new DemoMessageResponse("msg-1", "user", "제품 환불하고 싶습니다", "2026-05-10T09:00:00Z"),
          new DemoMessageResponse(
              "msg-2", "assistant", "네, 환불 도와드리겠습니다. 주문번호를 알려주세요.", "2026-05-10T09:00:15Z"),
          new DemoMessageResponse(
              MESSAGE_WITH_ORDER_NUMBER, "user", "주문번호는 ORD-12345입니다", "2026-05-10T09:01:00Z"),
          new DemoMessageResponse(
              "msg-4",
              "assistant",
              "ORD-12345 주문에 대한 환불이 완료되었습니다. 14일 이내에 계좌로 입금됩니다.",
              "2026-05-10T09:05:30Z"));
  private static final DemoExecutionResponse EXECUTION =
      new DemoExecutionResponse(
          "exec-1",
          STATE_COMPLETED,
          STATE_COMPLETED,
          "wf-node-final",
          "환불 요청",
          Map.of("orderNumber", "ORD-12345", "refundAmount", 59000),
          List.of(),
          List.of(new DemoPolicyHitResponse("policy-1", "환불 가능 기간", "PASS", "구매일로부터 14일 이내")),
          List.of(
              new DemoRiskHitResponse("risk-1", "고액 환불", "LOW", "환불 금액 59,000원 — 고액 환불 기준 미만")));
  private static final List<DemoDecisionLogResponse> DECISION_LOGS =
      List.of(
          new DemoDecisionLogResponse(
              "log-1",
              1,
              "msg-1",
              "INTENT_DETECTED",
              STATE_INITIAL,
              STATE_INTENT_DETECTED,
              DECISION_ALLOW,
              0.95,
              "환불 요청 패턴 감지"),
          new DemoDecisionLogResponse(
              "log-2",
              2,
              MESSAGE_WITH_ORDER_NUMBER,
              "SLOT_FILLED",
              STATE_INTENT_DETECTED,
              STATE_SLOT_COLLECTING,
              DECISION_ALLOW,
              0.88,
              "주문번호 slot 수집 완료"),
          new DemoDecisionLogResponse(
              "log-3",
              3,
              MESSAGE_WITH_ORDER_NUMBER,
              "POLICY_CHECKED",
              STATE_SLOT_COLLECTING,
              STATE_POLICY_CHECKING,
              DECISION_ALLOW,
              1.0,
              "환불 가능 기간 정책 통과"),
          new DemoDecisionLogResponse(
              "log-4",
              4,
              MESSAGE_WITH_ORDER_NUMBER,
              "RISK_CHECKED",
              STATE_POLICY_CHECKING,
              STATE_RISK_CHECKING,
              DECISION_ALLOW,
              0.75,
              "고액 환불 위험 낮음"),
          new DemoDecisionLogResponse(
              "log-5",
              5,
              "msg-4",
              "ANSWER_GENERATED",
              STATE_DECIDING,
              STATE_COMPLETED,
              DECISION_ALLOW,
              0.92,
              "환불 완료 안내 생성"));
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
