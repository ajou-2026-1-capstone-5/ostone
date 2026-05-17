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
import java.util.HashMap;
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
              STATE_INTENT_DETECTED,
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

  // === 시나리오 2L: 카드 이용내역 조회 ===
  private static final DemoDomainPackResponse CARD_DOMAIN_PACK =
      new DemoDomainPackResponse(
          "demo-pack-2",
          "카드 이용내역 조회 Domain Pack",
          "1.0.0",
          "PUBLISHED",
          List.of(
              new DemoIntentResponse("intent-3", "카드 이용내역 조회", "고객이 카드 이용내역을 조회하는 경우")),
          List.of(new DemoPolicyResponse("policy-2", "조회 가능 기간", "최근 3개월 이내 거래만 조회 가능", "HARD")),
          List.of(new DemoRiskResponse("risk-2", "대량 조회", "24시간 내 10회 이상 조회 시 리뷰 필요", "MEDIUM")));

  private static final DemoWorkflowResponse CARD_WORKFLOW =
      new DemoWorkflowResponse(
          "workflow-2",
          "카드 이용내역 조회 워크플로우",
          "고객 카드 이용내역 조회 처리",
          List.of("INITIAL", "INTENT_DETECTED", "SLOT_COLLECTING", "POLICY_CHECKING", "DECIDING", "COMPLETED"),
          List.of(
              new DemoTransitionResponse(STATE_INITIAL, STATE_INTENT_DETECTED, STATE_INTENT_DETECTED),
              new DemoTransitionResponse(STATE_INTENT_DETECTED, STATE_SLOT_COLLECTING, "SLOT_FILLED"),
              new DemoTransitionResponse(STATE_SLOT_COLLECTING, STATE_POLICY_CHECKING, "POLICY_CHECKED"),
              new DemoTransitionResponse(STATE_POLICY_CHECKING, STATE_DECIDING, "STATE_TRANSITIONED"),
              new DemoTransitionResponse(STATE_DECIDING, STATE_COMPLETED, "ANSWER_GENERATED")));

  private static final DemoChatSessionResponse CARD_CHAT_SESSION =
      new DemoChatSessionResponse("session-2", "completed", "2026-05-10T10:00:00Z", "2026-05-10T10:03:00Z");

  private static final List<DemoMessageResponse> CARD_MESSAGES =
      List.of(
          new DemoMessageResponse("msg-4", "user", "최근 카드 사용 내역을 확인하고 싶습니다", "2026-05-10T10:00:00Z"),
          new DemoMessageResponse("msg-5", "assistant", "네, 조회하시려는 기간과 카드 번호를 알려주시겠어요?", "2026-05-10T10:00:15Z"),
          new DemoMessageResponse("msg-6", "assistant", "죄송합니다만, 조회 가능 기간은 최근 3개월까지입니다. 2026년 2월부터 4월까지의 내역을 조회해드리겠습니다.", "2026-05-10T10:01:00Z"),
          new DemoMessageResponse("msg-7", "assistant", "고객님의 최근 3개월 카드 이용내역입니다. 총 5건, 1,250,000원이 사용되었습니다.", "2026-05-10T10:03:00Z"));

  private static final DemoExecutionResponse CARD_EXECUTION =
      new DemoExecutionResponse(
          "exec-2",
          STATE_COMPLETED,
          STATE_COMPLETED,
          "COMPLETED",
          "카드 이용내역 조회",
          Map.of("cardNumber", "****-****-****-1234", "period", "2026-02~2026-04"),
          List.of(),
          List.of(new DemoPolicyHitResponse("policy-2", "조회 가능 기간", "PASS", "최근 3개월 이내 조회")),
          List.of());

  private static final List<DemoDecisionLogResponse> CARD_DECISION_LOGS =
      List.of(
          new DemoDecisionLogResponse("log-6", 1, "msg-4", STATE_INTENT_DETECTED, STATE_INITIAL, STATE_INTENT_DETECTED, DECISION_ALLOW, 0.93, "카드 이용내역 조회 패턴 감지"),
          new DemoDecisionLogResponse("log-7", 2, "msg-5", "SLOT_FILLED", STATE_INTENT_DETECTED, STATE_SLOT_COLLECTING, DECISION_ALLOW, 0.90, "카드번호/기간 slot 수집 완료"),
          new DemoDecisionLogResponse("log-8", 3, "msg-6", "POLICY_CHECKED", STATE_SLOT_COLLECTING, STATE_POLICY_CHECKING, DECISION_ALLOW, 1.0, "조회 가능 기간 정책 통과"));

  private static final DemoChatWorkflowResponse CARD_CHAT_WORKFLOW =
      new DemoChatWorkflowResponse(CARD_DOMAIN_PACK, CARD_WORKFLOW, CARD_CHAT_SESSION, CARD_MESSAGES, CARD_EXECUTION, CARD_DECISION_LOGS);

  // === 시나리오 3L: 여행 숙소 예약 ===
  private static final DemoDomainPackResponse HOTEL_DOMAIN_PACK =
      new DemoDomainPackResponse(
          "demo-pack-3",
          "여행 숙소 예약 Domain Pack",
          "1.0.0",
          "PUBLISHED",
          List.of(
              new DemoIntentResponse("intent-4", "숙소 예약", "고객이 여행 숙소를 예약하는 경우")),
          List.of(new DemoPolicyResponse("policy-3", "취소 수수료", "체크인 7일 전까지 무료 취소 가능", "SOFT")),
          List.of(new DemoRiskResponse("risk-3", "고액 예약", "100만원 이상 예약 시 추가 확인 필요", "MEDIUM")));

  private static final DemoWorkflowResponse HOTEL_WORKFLOW =
      new DemoWorkflowResponse(
          "workflow-3",
          "숙소 예약 워크플로우",
          "고객 여행 숙소 예약 처리",
          List.of("INITIAL", "INTENT_DETECTED", "SLOT_COLLECTING", "POLICY_CHECKING", "RISK_CHECKING", "DECIDING", "COMPLETED"),
          List.of(
              new DemoTransitionResponse(STATE_INITIAL, STATE_INTENT_DETECTED, STATE_INTENT_DETECTED),
              new DemoTransitionResponse(STATE_INTENT_DETECTED, STATE_SLOT_COLLECTING, "SLOT_FILLED"),
              new DemoTransitionResponse(STATE_SLOT_COLLECTING, STATE_POLICY_CHECKING, "POLICY_CHECKED"),
              new DemoTransitionResponse(STATE_POLICY_CHECKING, STATE_RISK_CHECKING, "RISK_CHECKED"),
              new DemoTransitionResponse(STATE_RISK_CHECKING, STATE_DECIDING, "STATE_TRANSITIONED"),
              new DemoTransitionResponse(STATE_DECIDING, STATE_COMPLETED, "ANSWER_GENERATED")));

  private static final DemoChatSessionResponse HOTEL_CHAT_SESSION =
      new DemoChatSessionResponse("session-3", "completed", "2026-05-10T11:00:00Z", "2026-05-10T11:06:00Z");

  private static final List<DemoMessageResponse> HOTEL_MESSAGES =
      List.of(
          new DemoMessageResponse("msg-8", "user", "다음 주에 제주도 여행 가는데 숙소 예약하고 싶어요", "2026-05-10T11:00:00Z"),
          new DemoMessageResponse("msg-9", "assistant", "네, 몇 분이서 가시나요? 그리고 체크인과 체크아웃 날짜를 알려주세요.", "2026-05-10T11:00:20Z"),
          new DemoMessageResponse("msg-10", "assistant", "목적지와 일정이 확인되었습니다. 정책 검토 중입니다...", "2026-05-10T11:01:00Z"),
          new DemoMessageResponse("msg-11", "assistant", "해당 숙소는 100만원 이상 예약으로 리뷰가 필요합니다. 확인 후 진행해드리겠습니다.", "2026-05-10T11:02:00Z"),
          new DemoMessageResponse("msg-12", "assistant", "예약이 완료되었습니다. 제주도 XXX 호텔, 5월 20일-22일, 2인, 총 850,000원.", "2026-05-10T11:06:00Z"));

  private static final DemoExecutionResponse HOTEL_EXECUTION =
      new DemoExecutionResponse(
          "exec-3",
          STATE_COMPLETED,
          STATE_COMPLETED,
          "COMPLETED",
          "숙소 예약",
          Map.of("destination", "제주도", "checkIn", "2026-05-20", "checkOut", "2026-05-22", "guests", "2"),
          List.of(),
          List.of(new DemoPolicyHitResponse("policy-3", "취소 수수료", "PASS", "체크인 7일 전 무료 취소 가능")),
          List.of(new DemoRiskHitResponse("risk-3", "고액 예약", "FLAG", "850,000원 예약 — 리뷰 후 승인")));

  private static final List<DemoDecisionLogResponse> HOTEL_DECISION_LOGS =
      List.of(
          new DemoDecisionLogResponse("log-9", 1, "msg-8", STATE_INTENT_DETECTED, STATE_INITIAL, STATE_INTENT_DETECTED, DECISION_ALLOW, 0.96, "숙소 예약 패턴 감지"),
          new DemoDecisionLogResponse("log-10", 2, "msg-9", "SLOT_FILLED", STATE_INTENT_DETECTED, STATE_SLOT_COLLECTING, DECISION_ALLOW, 0.88, "여행 일정/인원 slot 수집 완료"),
          new DemoDecisionLogResponse("log-11", 3, "msg-10", "POLICY_CHECKED", STATE_SLOT_COLLECTING, STATE_POLICY_CHECKING, DECISION_ALLOW, 1.0, "취소 수수료 정책 통과"),
          new DemoDecisionLogResponse("log-12", 4, "msg-10", "RISK_CHECKED", STATE_POLICY_CHECKING, STATE_RISK_CHECKING, DECISION_ALLOW, 0.70, "고액 예약 위험 검토 필요"),
          new DemoDecisionLogResponse("log-13", 5, "msg-12", "ANSWER_GENERATED", STATE_DECIDING, STATE_COMPLETED, DECISION_ALLOW, 0.95, "숙소 예약 완료 안내 생성"));

  private static final DemoChatWorkflowResponse HOTEL_CHAT_WORKFLOW =
      new DemoChatWorkflowResponse(HOTEL_DOMAIN_PACK, HOTEL_WORKFLOW, HOTEL_CHAT_SESSION, HOTEL_MESSAGES, HOTEL_EXECUTION, HOTEL_DECISION_LOGS);

  private static final Map<Long, DemoChatWorkflowResponse> SCENARIOS = new HashMap<>();

  static {
    SCENARIOS.put(1L, CHAT_WORKFLOW);
    SCENARIOS.put(2L, CARD_CHAT_WORKFLOW);
    SCENARIOS.put(3L, HOTEL_CHAT_WORKFLOW);
  }

  public DemoChatWorkflowResponse provideChatWorkflow(Long workspaceId) {
    return SCENARIOS.get(workspaceId);
  }

  public DemoChatSessionResponse findSession(Long workspaceId, String sessionId) {
    DemoChatWorkflowResponse scenario = SCENARIOS.get(workspaceId);
    if (scenario == null) return null;
    if (scenario.chatSession().id().equals(sessionId)) {
      return scenario.chatSession();
    }
    return null;
  }

  public List<DemoMessageResponse> findSessionMessages(Long workspaceId, String sessionId) {
    DemoChatWorkflowResponse scenario = SCENARIOS.get(workspaceId);
    if (scenario == null) return List.of();
    if (scenario.chatSession().id().equals(sessionId)) {
      return scenario.messages();
    }
    return List.of();
  }

  public DemoExecutionResponse findExecution(Long workspaceId, String executionId) {
    DemoChatWorkflowResponse scenario = SCENARIOS.get(workspaceId);
    if (scenario == null) return null;
    if (scenario.execution().id().equals(executionId)) {
      return scenario.execution();
    }
    return null;
  }

  public List<DemoDecisionLogResponse> findDecisionLogs(Long workspaceId, String executionId) {
    DemoChatWorkflowResponse scenario = SCENARIOS.get(workspaceId);
    if (scenario == null) return List.of();
    if (scenario.execution().id().equals(executionId)) {
      return scenario.decisionLogs();
    }
    return List.of();
  }
}
