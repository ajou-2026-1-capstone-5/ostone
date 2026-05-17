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
  private static final String STATE_HANDOFF = "HANDOFF";
  private static final String STATE_IDENTITY_VERIFICATION = "IDENTITY_VERIFICATION";
  private static final String STATE_PAYMENT_INFO_COLLECTING = "PAYMENT_INFO_COLLECTING";
  private static final String STATE_USAGE_HISTORY_SEARCHING = "USAGE_HISTORY_SEARCHING";
  private static final String STATE_MISMATCH_ANALYSIS = "MISMATCH_ANALYSIS";
  private static final String STATE_EVIDENCE_REQUESTING = "EVIDENCE_REQUESTING";
  private static final String STATE_DEPARTMENT_ESCALATION = "DEPARTMENT_ESCALATION";
  private static final String STATE_CALLBACK_GUIDE = "CALLBACK_GUIDE";
  private static final String STATE_HANDED_OFF = "HANDED_OFF";
  private static final String STATE_AVAILABILITY_CHECKING = "AVAILABILITY_CHECKING";
  private static final String STATE_ALTERNATIVE_OFFERING = "ALTERNATIVE_OFFERING";
  private static final String STATE_RESERVATION_GUIDE = "RESERVATION_GUIDE";
  private static final String STATE_PICKUP_GUIDE = "PICKUP_GUIDE";
  private static final String STATE_BENEFIT_GUIDE = "BENEFIT_GUIDE";
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
              STATE_HANDOFF),
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
              new DemoTransitionResponse(STATE_DECIDING, STATE_HANDOFF, "HANDOFF_TRIGGERED")));
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
          "card-usage-inquiry-demo-pack",
          "카드 이용내역 조회 상담 Demo Pack",
          "1.0.0",
          "PUBLISHED",
          List.of(
              new DemoIntentResponse(
                  "CARD_USAGE_HISTORY_INQUIRY",
                  "카드 이용내역 조회 및 결제 내역 확인 문의",
                  "고객이 특정 날짜, 시간, 금액, 가맹점명, 카드번호 일부를 기준으로 카드 이용내역 또는 승인 내역을 확인하려는 상담")),
          List.of(
              new DemoPolicyResponse(
                  "IDENTITY_VERIFICATION_REQUIRED",
                  "이용내역 조회 전 본인 확인 필요",
                  "카드 이용내역은 개인정보 및 금융정보에 해당하므로 조회 전 본인 확인을 먼저 수행해야 한다.",
                  "HARD"),
              new DemoPolicyResponse(
                  "USAGE_SEARCH_BY_PAYMENT_INFO",
                  "결제 정보 기반 이용내역 조회",
                  "결제일, 결제 시간, 금액, 가맹점명, 카드번호 끝자리 등을 기준으로 이용내역을 조회한다.",
                  "HARD"),
              new DemoPolicyResponse(
                  "APP_SCREENSHOT_REQUIRED_ON_MISMATCH",
                  "조회 결과 불일치 시 고객 화면 증빙 요청",
                  "상담사 조회 결과에는 내역이 없지만 고객 앱 화면에는 내역이 표시되는 경우, 화면 캡처를 받아 담당부서 확인을 요청한다.",
                  "HARD"),
              new DemoPolicyResponse(
                  "DEPARTMENT_ESCALATION_REQUIRED",
                  "담당부서 확인 요청 필요",
                  "고객 화면과 상담사 조회 시스템의 결과가 불일치하는 경우 상담사가 직접 확정 답변하지 않고 담당부서 확인 요청으로 넘긴다.",
                  "HARD"),
              new DemoPolicyResponse(
                  "CALLBACK_TIME_GUIDE",
                  "처리 시간 및 콜백 안내",
                  "담당부서 확인 요청은 즉시 답변이 어려울 수 있으므로 고객에게 답변 예정 시간을 안내한다.",
                  "SOFT")),
          List.of(
              new DemoRiskResponse(
                  "FINANCIAL_INFO_ACCESS",
                  "금융 이용내역 조회",
                  "카드 이용내역, 승인번호, 결제 금액 등 민감한 금융정보를 다루므로 본인 확인과 최소 정보 수집이 필요하다.",
                  "HIGH"),
              new DemoRiskResponse(
                  "SYSTEM_CUSTOMER_VIEW_MISMATCH",
                  "상담사 조회 결과와 고객 앱 화면 불일치",
                  "상담사 시스템에는 내역이 없지만 고객 앱에는 내역이 보이는 경우 잘못된 안내 또는 민원 확대 가능성이 있다.",
                  "MEDIUM"),
              new DemoRiskResponse(
                  "CUSTOMER_REPEATED_CONTACT",
                  "반복 문의로 인한 고객 불만 가능성",
                  "고객이 같은 문제로 카드사에 여러 차례 전화했다고 언급했으므로 불만이 누적된 상태일 수 있다.",
                  "MEDIUM"),
              new DemoRiskResponse(
                  "PAYMENT_CHANNEL_CONFUSION",
                  "카드결제와 계좌결제 표시 혼선",
                  "고객은 신용카드로 결제했다고 인식하지만 앱에는 은행 계좌 결제처럼 표시되어 결제 경로 확인이 필요하다.",
                  "LOW")));

  private static final DemoWorkflowResponse CARD_WORKFLOW =
      new DemoWorkflowResponse(
          "CARD_USAGE_HISTORY_INQUIRY_WORKFLOW",
          "카드 이용내역 조회 및 증빙 확인 워크플로우",
          "고객의 특정 결제 내역 조회 요청을 처리하고, 조회 결과가 고객 화면과 불일치할 경우 증빙 제출과 담당부서 확인 요청으로 이어지는 워크플로우",
          List.of(
              STATE_INITIAL,
              STATE_IDENTITY_VERIFICATION,
              STATE_INTENT_DETECTED,
              STATE_PAYMENT_INFO_COLLECTING,
              STATE_USAGE_HISTORY_SEARCHING,
              STATE_MISMATCH_ANALYSIS,
              STATE_EVIDENCE_REQUESTING,
              STATE_DEPARTMENT_ESCALATION,
              STATE_CALLBACK_GUIDE,
              STATE_COMPLETED,
              STATE_HANDED_OFF),
          List.of(
              new DemoTransitionResponse(
                  STATE_INITIAL, STATE_IDENTITY_VERIFICATION, "CUSTOMER_REQUESTED_USAGE_HISTORY"),
              new DemoTransitionResponse(
                  STATE_IDENTITY_VERIFICATION, STATE_INTENT_DETECTED, "CUSTOMER_IDENTITY_VERIFIED"),
              new DemoTransitionResponse(
                  STATE_INTENT_DETECTED, STATE_PAYMENT_INFO_COLLECTING, "PAYMENT_QUERY_STARTED"),
              new DemoTransitionResponse(
                  STATE_PAYMENT_INFO_COLLECTING, STATE_USAGE_HISTORY_SEARCHING, "PAYMENT_INFO_FILLED"),
              new DemoTransitionResponse(
                  STATE_USAGE_HISTORY_SEARCHING, STATE_MISMATCH_ANALYSIS, "USAGE_HISTORY_NOT_FOUND"),
              new DemoTransitionResponse(
                  STATE_MISMATCH_ANALYSIS,
                  STATE_PAYMENT_INFO_COLLECTING,
                  "ADDITIONAL_PAYMENT_INFO_REQUESTED"),
              new DemoTransitionResponse(
                  STATE_MISMATCH_ANALYSIS, STATE_EVIDENCE_REQUESTING, "CUSTOMER_APP_SCREEN_VISIBLE"),
              new DemoTransitionResponse(
                  STATE_EVIDENCE_REQUESTING, STATE_DEPARTMENT_ESCALATION, "SCREENSHOT_REQUESTED"),
              new DemoTransitionResponse(
                  STATE_DEPARTMENT_ESCALATION, STATE_CALLBACK_GUIDE, "DEPARTMENT_CHECK_REQUESTED"),
              new DemoTransitionResponse(
                  STATE_CALLBACK_GUIDE, STATE_COMPLETED, "CALLBACK_DEADLINE_INFORMED"),
              new DemoTransitionResponse(
                  STATE_MISMATCH_ANALYSIS, STATE_HANDED_OFF, "COMPLEX_PAYMENT_MISMATCH")));

  private static final DemoChatSessionResponse CARD_CHAT_SESSION =
      new DemoChatSessionResponse(
          "session-2", "completed", "2026-05-10T10:00:00Z", "2026-05-10T10:09:30Z");

  private static final List<DemoMessageResponse> CARD_MESSAGES =
      List.of(
          new DemoMessageResponse("card-msg-1", "assistant", "상담원 ▲▲▲입니다.", "2026-05-10T10:00:00Z"),
          new DemoMessageResponse(
              "card-msg-2", "user", "네, 안녕하세요. 그 이용내역 좀 조회하려고 그러는데요.", "2026-05-10T10:00:20Z"),
          new DemoMessageResponse(
              "card-msg-3", "assistant", "네, ▲▲▲ 님 본인 맞으시죠?", "2026-05-10T10:00:40Z"),
          new DemoMessageResponse("card-msg-4", "user", "네, 네. 맞아요.", "2026-05-10T10:01:00Z"),
          new DemoMessageResponse(
              "card-msg-5", "user", "▲▲월 ▲▲일이요. 결제한 금액 좀 조회하려고 하는데.", "2026-05-10T10:01:20Z"),
          new DemoMessageResponse(
              "card-msg-6", "assistant", "네, ▲▲월 ▲▲일이요. 조회해 보겠습니다. 잠시만요.", "2026-05-10T10:01:40Z"),
          new DemoMessageResponse(
              "card-msg-7", "assistant", "어, 어디라고 하셨죠?", "2026-05-10T10:02:00Z"),
          new DemoMessageResponse("card-msg-8", "user", "그 ▲▲▲▲원짜리 뭐 없나요?", "2026-05-10T10:02:20Z"),
          new DemoMessageResponse("card-msg-9", "assistant", "없는데요.", "2026-05-10T10:02:40Z"),
          new DemoMessageResponse(
              "card-msg-10",
              "user",
              "그 저한테 뜨거든요, 제가 이용내역 그 승인 번호 알려드리면 되나요?",
              "2026-05-10T10:03:00Z"),
          new DemoMessageResponse(
              "card-msg-11",
              "assistant",
              "어, 아니요. 승인 번호 말고 그 결제 시간이랑 금액이랑 가맹점명이랑 말씀해 주시겠어요?",
              "2026-05-10T10:03:25Z"),
          new DemoMessageResponse(
              "card-msg-12",
              "user",
              "▲▲일 ▲▲시 ▲▲분에 산업 안전 교육 결제를 했어요. ▲▲▲▲원.",
              "2026-05-10T10:03:55Z"),
          new DemoMessageResponse(
              "card-msg-13", "user", "신용카드로 결제를 했는데 ▲▲ 은행 계좌 결제라고 뜨거든요?", "2026-05-10T10:04:20Z"),
          new DemoMessageResponse(
              "card-msg-14", "assistant", "카드 번호 끝 네 자리 말씀해 주시겠어요?", "2026-05-10T10:04:45Z"),
          new DemoMessageResponse(
              "card-msg-15", "user", "▲▲▲▲번이요. ▲▲카드 신용카드로 결제를 했어요.", "2026-05-10T10:05:10Z"),
          new DemoMessageResponse(
              "card-msg-16",
              "assistant",
              "그러시면 그 저희 앱에서 확인 하신 그 화면을 캡쳐하셔서 저희 대표 번호로 문자로 좀 보내주실 수 있을까요?",
              "2026-05-10T10:05:35Z"),
          new DemoMessageResponse(
              "card-msg-17", "user", "예. 그 문자 번호가 어떻게 되죠?", "2026-05-10T10:06:00Z"),
          new DemoMessageResponse(
              "card-msg-18", "assistant", "저희 ▲▲번에 ▲ 네 개 번으로 보내주시면 되고요.", "2026-05-10T10:06:20Z"),
          new DemoMessageResponse(
              "card-msg-19",
              "assistant",
              "네, 끊으시고 보내주시면 제가 그거 확인해서 담당부서에 확인 요청하도록 하겠습니다.",
              "2026-05-10T10:06:45Z"),
          new DemoMessageResponse(
              "card-msg-20",
              "user",
              "알겠습니다. 그러면 바로 전화 오나요? 제가 지금 어디 나가야 돼서.",
              "2026-05-10T10:07:15Z"),
          new DemoMessageResponse(
              "card-msg-21",
              "assistant",
              "일단 저희가 담당부서에 확인 요청하면 바로 답변이 달리지는 않아서요. 6시 전까지 전화를 드리겠습니다.",
              "2026-05-10T10:07:45Z"),
          new DemoMessageResponse(
              "card-msg-22", "user", "네, 네. 이 번호로 드리면 되죠? 문자?", "2026-05-10T10:08:40Z"),
          new DemoMessageResponse(
              "card-msg-23",
              "assistant",
              "네, ▲▲에 ▲ 네 개 번호 문자로 해서 캡쳐만 보내주시면 됩니다.",
              "2026-05-10T10:09:30Z"));

  private static final DemoExecutionResponse CARD_EXECUTION =
      new DemoExecutionResponse(
          "exec-2",
          STATE_COMPLETED,
          STATE_COMPLETED,
          STATE_COMPLETED,
          "카드 이용내역 조회 및 결제 내역 확인 문의",
          Map.of(
              "customer_identity_verified",
              true,
              "payment_date",
              "▲▲일",
              "payment_time",
              "▲▲시 ▲▲분",
              "payment_amount",
              "▲▲▲▲원",
              "merchant_name",
              "산업 안전 교육",
              "approval_number",
              "고객 보유",
              "card_last_digits",
              "▲▲▲▲",
              "payment_channel",
              "신용카드 결제 인식 / 은행 계좌 결제로 표시",
              "callback_deadline",
              "오늘 6시 전까지"),
          List.of("customer_app_evidence"),
          List.of(
              new DemoPolicyHitResponse(
                  "IDENTITY_VERIFICATION_REQUIRED", "이용내역 조회 전 본인 확인 필요", "PASS", "본인 확인 후 조회 진행"),
              new DemoPolicyHitResponse(
                  "USAGE_SEARCH_BY_PAYMENT_INFO",
                  "결제 정보 기반 이용내역 조회",
                  "PASS",
                  "결제일, 시간, 금액, 가맹점명, 카드 끝자리 기반 조회"),
              new DemoPolicyHitResponse(
                  "APP_SCREENSHOT_REQUIRED_ON_MISMATCH",
                  "조회 결과 불일치 시 고객 화면 증빙 요청",
                  "PASS",
                  "고객 앱 화면 표시와 상담사 조회 결과 불일치로 캡처 요청"),
              new DemoPolicyHitResponse(
                  "DEPARTMENT_ESCALATION_REQUIRED",
                  "담당부서 확인 요청 필요",
                  "PASS",
                  "증빙 수신 후 담당부서 확인 요청으로 안내"),
              new DemoPolicyHitResponse(
                  "CALLBACK_TIME_GUIDE", "처리 시간 및 콜백 안내", "PASS", "오늘 6시 전까지 콜백 예정 안내")),
          List.of(
              new DemoRiskHitResponse(
                  "FINANCIAL_INFO_ACCESS", "금융 이용내역 조회", "HIGH", "본인 확인 완료 후 필요한 결제 정보만 수집"),
              new DemoRiskHitResponse(
                  "SYSTEM_CUSTOMER_VIEW_MISMATCH",
                  "상담사 조회 결과와 고객 앱 화면 불일치",
                  "MEDIUM",
                  "고객 화면 캡처를 받아 담당부서 확인 요청"),
              new DemoRiskHitResponse(
                  "CUSTOMER_REPEATED_CONTACT",
                  "반복 문의로 인한 고객 불만 가능성",
                  "MEDIUM",
                  "반복 문의 상황을 인정하고 콜백 시간을 명확히 안내"),
              new DemoRiskHitResponse(
                  "PAYMENT_CHANNEL_CONFUSION",
                  "카드결제와 계좌결제 표시 혼선",
                  "LOW",
                  "결제 방식, 카드번호 끝자리, 앱 화면을 함께 대조")));

  private static final List<DemoDecisionLogResponse> CARD_DECISION_LOGS =
      List.of(
          new DemoDecisionLogResponse(
              "log-6",
              1,
              "card-msg-2",
              "ACTION_SELECTED",
              STATE_INITIAL,
              STATE_IDENTITY_VERIFICATION,
              DECISION_ALLOW,
              0.92,
              "고객이 이용내역 조회를 요청해 본인 확인 단계로 진입"),
          new DemoDecisionLogResponse(
              "log-7",
              2,
              "card-msg-4",
              "POLICY_CHECKED",
              STATE_IDENTITY_VERIFICATION,
              STATE_INTENT_DETECTED,
              DECISION_ALLOW,
              0.98,
              "본인 확인 완료"),
          new DemoDecisionLogResponse(
              "log-8",
              3,
              "card-msg-5",
              STATE_INTENT_DETECTED,
              STATE_INTENT_DETECTED,
              STATE_PAYMENT_INFO_COLLECTING,
              DECISION_ALLOW,
              0.94,
              "특정 결제 이용내역 조회 intent 감지"),
          new DemoDecisionLogResponse(
              "log-9",
              4,
              "card-msg-6",
              "POLICY_CHECKED",
              STATE_PAYMENT_INFO_COLLECTING,
              STATE_USAGE_HISTORY_SEARCHING,
              DECISION_ALLOW,
              0.9,
              "결제일 기준 이용내역 조회 시작"),
          new DemoDecisionLogResponse(
              "log-10",
              5,
              "card-msg-7",
              "SLOT_FILLED",
              STATE_USAGE_HISTORY_SEARCHING,
              STATE_PAYMENT_INFO_COLLECTING,
              DECISION_ALLOW,
              0.82,
              "가맹점명과 결제 금액 추가 수집 필요"),
          new DemoDecisionLogResponse(
              "log-11",
              6,
              "card-msg-8",
              "SLOT_FILLED",
              STATE_PAYMENT_INFO_COLLECTING,
              STATE_USAGE_HISTORY_SEARCHING,
              DECISION_ALLOW,
              0.88,
              "결제 금액 slot 보강 후 재조회"),
          new DemoDecisionLogResponse(
              "log-12",
              7,
              "card-msg-9",
              "POLICY_CHECKED",
              STATE_USAGE_HISTORY_SEARCHING,
              STATE_MISMATCH_ANALYSIS,
              DECISION_ALLOW,
              0.86,
              "상담사 시스템에서 해당 이용내역 미조회"),
          new DemoDecisionLogResponse(
              "log-13",
              8,
              "card-msg-10",
              "RISK_CHECKED",
              STATE_MISMATCH_ANALYSIS,
              STATE_MISMATCH_ANALYSIS,
              DECISION_ALLOW,
              0.84,
              "고객 앱에는 표시된다는 불일치 상황 확인"),
          new DemoDecisionLogResponse(
              "log-14",
              9,
              "card-msg-11",
              "SLOT_FILLED",
              STATE_MISMATCH_ANALYSIS,
              STATE_PAYMENT_INFO_COLLECTING,
              DECISION_ALLOW,
              0.87,
              "승인번호 대신 결제 시간, 금액, 가맹점명 요청"),
          new DemoDecisionLogResponse(
              "log-15",
              10,
              "card-msg-12",
              "POLICY_CHECKED",
              STATE_PAYMENT_INFO_COLLECTING,
              STATE_USAGE_HISTORY_SEARCHING,
              DECISION_ALLOW,
              0.93,
              "결제 시간, 금액, 가맹점명 기반 재조회"),
          new DemoDecisionLogResponse(
              "log-16",
              11,
              "card-msg-13",
              "RISK_CHECKED",
              STATE_USAGE_HISTORY_SEARCHING,
              STATE_MISMATCH_ANALYSIS,
              DECISION_ALLOW,
              0.81,
              "카드결제와 계좌결제 표시 혼선 위험 감지"),
          new DemoDecisionLogResponse(
              "log-17",
              12,
              "card-msg-14",
              "SLOT_FILLED",
              STATE_MISMATCH_ANALYSIS,
              STATE_PAYMENT_INFO_COLLECTING,
              DECISION_ALLOW,
              0.87,
              "카드번호 끝자리 추가 요청"),
          new DemoDecisionLogResponse(
              "log-18",
              13,
              "card-msg-15",
              "POLICY_CHECKED",
              STATE_PAYMENT_INFO_COLLECTING,
              STATE_USAGE_HISTORY_SEARCHING,
              DECISION_ALLOW,
              0.9,
              "카드번호 끝자리 기준 재조회"),
          new DemoDecisionLogResponse(
              "log-19",
              14,
              "card-msg-16",
              "STATE_TRANSITIONED",
              STATE_MISMATCH_ANALYSIS,
              STATE_EVIDENCE_REQUESTING,
              DECISION_ALLOW,
              0.89,
              "조회 결과 불일치로 고객 앱 화면 캡처 요청"),
          new DemoDecisionLogResponse(
              "log-20",
              15,
              "card-msg-19",
              "HANDOFF_TRIGGERED",
              STATE_EVIDENCE_REQUESTING,
              STATE_DEPARTMENT_ESCALATION,
              DECISION_ALLOW,
              0.92,
              "증빙 수신 후 담당부서 확인 요청 안내"),
          new DemoDecisionLogResponse(
              "log-21",
              16,
              "card-msg-21",
              "POLICY_CHECKED",
              STATE_DEPARTMENT_ESCALATION,
              STATE_CALLBACK_GUIDE,
              DECISION_ALLOW,
              0.95,
              "담당부서 확인 후 오늘 6시 전까지 콜백 예정 안내"),
          new DemoDecisionLogResponse(
              "log-22",
              17,
              "card-msg-23",
              "ANSWER_GENERATED",
              STATE_CALLBACK_GUIDE,
              STATE_COMPLETED,
              DECISION_ALLOW,
              0.94,
              "증빙 제출 번호 재확인 후 상담 종료"));

  private static final DemoChatWorkflowResponse CARD_CHAT_WORKFLOW =
      new DemoChatWorkflowResponse(
          CARD_DOMAIN_PACK,
          CARD_WORKFLOW,
          CARD_CHAT_SESSION,
          CARD_MESSAGES,
          CARD_EXECUTION,
          CARD_DECISION_LOGS);

  // === 시나리오 3L: 여행 숙소 예약 ===
  private static final DemoDomainPackResponse HOTEL_DOMAIN_PACK =
      new DemoDomainPackResponse(
          "travel-reservation-demo-pack",
          "여행 숙소 예약 상담 Demo Pack",
          "1.0.0",
          "PUBLISHED",
          List.of(
              new DemoIntentResponse(
                  "RESORT_ROOM_RESERVATION_INQUIRY",
                  "리조트 객실 예약 가능 여부 및 예약 진행 문의",
                  "고객이 특정 숙소, 일정, 객실 타입, 프로모션 조건을 기준으로 예약 가능 여부를 확인하고 예약 진행 방법을 문의하는 상담")),
          List.of(
              new DemoPolicyResponse(
                  "ROOM_AVAILABILITY_REQUIRED",
                  "객실 가능 여부 확인 필요",
                  "예약 진행 전 고객이 요청한 날짜와 객실 타입의 가능 여부를 확인해야 한다.",
                  "HARD"),
              new DemoPolicyResponse(
                  "ALTERNATIVE_ROOM_OFFER",
                  "요청 객실 불가 시 대안 객실 제안",
                  "고객이 요청한 객실이 불가능한 경우, 가능한 다른 객실 타입과 가격을 안내한다.",
                  "SOFT"),
              new DemoPolicyResponse(
                  "CLASSIC_ROOM_PROMO_PRICE",
                  "클래식룸 1+1 특가 안내",
                  "인디고 클래식룸 1+1 적용 시 2박 360달러이며, 성인 2인 기준 조식과 세금이 포함된다.",
                  "SOFT"),
              new DemoPolicyResponse(
                  "AIRPORT_PICKUP_POLICY",
                  "공항 픽업 안내",
                  "공항 픽업은 무료이며, 우붓 지역 픽업은 특가 15달러로 안내한다.",
                  "SOFT"),
              new DemoPolicyResponse(
                  "POST_BOOKING_BENEFIT",
                  "예약 완료 후 혜택 안내",
                  "예약 완료 후 발리 한국어 지도와 맛집 리스트 파일을 제공한다.",
                  "SOFT")),
          List.of(
              new DemoRiskResponse(
                  "PERSONAL_INFO_COLLECTION",
                  "개인정보 수집 필요",
                  "예약 진행을 위해 이름, 생년월일, 이메일, 연락처 등 개인정보를 수집해야 한다.",
                  "MEDIUM"),
              new DemoRiskResponse(
                  "AVAILABILITY_MISMATCH",
                  "예약 가능 여부 오인 가능성",
                  "고객이 이전에 확인한 가능 여부와 현재 상담사의 안내가 다를 수 있어 혼선이 발생할 수 있다.",
                  "LOW")));

  private static final DemoWorkflowResponse HOTEL_WORKFLOW =
      new DemoWorkflowResponse(
          "RESORT_RESERVATION_WORKFLOW",
          "리조트 객실 예약 상담 워크플로우",
          "고객의 숙소 예약 가능 여부 문의를 처리하고, 가능한 대안 객실과 예약 진행 정보를 안내하는 워크플로우",
          List.of(
              STATE_INITIAL,
              STATE_INTENT_DETECTED,
              STATE_SLOT_COLLECTING,
              STATE_AVAILABILITY_CHECKING,
              STATE_ALTERNATIVE_OFFERING,
              STATE_RESERVATION_GUIDE,
              STATE_PICKUP_GUIDE,
              STATE_BENEFIT_GUIDE,
              STATE_COMPLETED,
              STATE_HANDED_OFF),
          List.of(
              new DemoTransitionResponse(
                  STATE_INITIAL, STATE_INTENT_DETECTED, "RESERVATION_INTENT_DETECTED"),
              new DemoTransitionResponse(
                  STATE_INTENT_DETECTED, STATE_SLOT_COLLECTING, "REQUIRED_SLOT_CHECK_STARTED"),
              new DemoTransitionResponse(
                  STATE_SLOT_COLLECTING, STATE_AVAILABILITY_CHECKING, "REQUIRED_SLOTS_FILLED"),
              new DemoTransitionResponse(
                  STATE_AVAILABILITY_CHECKING, STATE_SLOT_COLLECTING, "ALTERNATIVE_DATE_REQUESTED"),
              new DemoTransitionResponse(
                  STATE_AVAILABILITY_CHECKING, STATE_ALTERNATIVE_OFFERING, "REQUESTED_ROOM_UNAVAILABLE"),
              new DemoTransitionResponse(
                  STATE_ALTERNATIVE_OFFERING, STATE_RESERVATION_GUIDE, "AVAILABLE_ROOM_CONFIRMED"),
              new DemoTransitionResponse(
                  STATE_RESERVATION_GUIDE, STATE_PICKUP_GUIDE, "PICKUP_QUESTION_ASKED"),
              new DemoTransitionResponse(
                  STATE_PICKUP_GUIDE, STATE_BENEFIT_GUIDE, "POST_BOOKING_BENEFIT_QUESTION_ASKED"),
              new DemoTransitionResponse(STATE_BENEFIT_GUIDE, STATE_COMPLETED, "CUSTOMER_THANKED"),
              new DemoTransitionResponse(
                  STATE_AVAILABILITY_CHECKING, STATE_HANDED_OFF, "AVAILABILITY_UNKNOWN"),
              new DemoTransitionResponse(
                  STATE_RESERVATION_GUIDE, STATE_HANDED_OFF, "SENSITIVE_OR_COMPLEX_REQUEST")));

  private static final DemoChatSessionResponse HOTEL_CHAT_SESSION =
      new DemoChatSessionResponse(
          "session-3", "completed", "2026-05-10T11:00:00Z", "2026-05-10T11:06:30Z");

  private static final List<DemoMessageResponse> HOTEL_MESSAGES =
      List.of(
          new DemoMessageResponse(
              "msg-8",
              "user",
              "안녕하세요. 인디고발리 ▲▲일부터 1+1으로 2박 가능한지 문의드렸던 사람인데요. 씨브리즈룸 2박 가능한 거 확인했는데, 그거랑 상관없는 건가요?",
              "2026-05-10T11:00:00Z"),
          new DemoMessageResponse(
              "msg-9",
              "assistant",
              "안녕하세요. 문의 주셔서 감사합니다. 씨브리즈룸은 해당 기간에 예약이 불가능합니다.",
              "2026-05-10T11:00:20Z"),
          new DemoMessageResponse(
              "msg-10",
              "user",
              "아, 그렇군요. 그럼 ▲▲일부터 2박이 안 된다면 ▲▲일부터 2박은 가능한가요?",
              "2026-05-10T11:00:45Z"),
          new DemoMessageResponse(
              "msg-11", "assistant", "▲▲일부터 2박도 현재로서는 예약이 불가능합니다.", "2026-05-10T11:01:05Z"),
          new DemoMessageResponse(
              "msg-12", "user", "그럼 클래식 룸으로는 예약이 가능한가요?", "2026-05-10T11:01:30Z"),
          new DemoMessageResponse(
              "msg-13",
              "assistant",
              "네, 클래식 룸은 예약 가능합니다. 인디고 클래식룸 1+1 적용 시 2박에 360달러입니다. 성인 2인 기준으로 조식과 세금 포함된 가격이에요.",
              "2026-05-10T11:01:55Z"),
          new DemoMessageResponse(
              "msg-14", "user", "알겠습니다. 예약 진행하려면 어떻게 해야 할까요?", "2026-05-10T11:02:20Z"),
          new DemoMessageResponse(
              "msg-15",
              "assistant",
              "예약 진행 원하시면, 룸 가능 여부 답변 받았다고 적어주시고, 가족분들 영문 및 한글 성함, 생년월일, 대표분의 이메일 주소와 연락처를 이메일로 보내주시면 됩니다.",
              "2026-05-10T11:02:50Z"),
          new DemoMessageResponse(
              "msg-16", "user", "공항 픽업을 받을 때 별도의 요구 사항을 반영할 수 있나요?", "2026-05-10T11:03:20Z"),
          new DemoMessageResponse(
              "msg-17",
              "assistant",
              "공항 픽업은 무료로 제공되며, 우붓 지역은 특가로 15달러에 제공됩니다. 이용하시는 항공편명 정보도 함께 적어주시면 됩니다.",
              "2026-05-10T11:03:50Z"),
          new DemoMessageResponse(
              "msg-18", "user", "예약을 하고 나면 어떤 혜택을 기대할 수 있나요?", "2026-05-10T11:04:30Z"),
          new DemoMessageResponse(
              "msg-19",
              "assistant",
              "예약 완료 후에는 발리 한국어 지도와 맛집 리스트 파일을 보내드려요. 추가로 궁금한 점 있으시면 언제든지 문의해 주세요.",
              "2026-05-10T11:05:00Z"),
          new DemoMessageResponse("msg-20", "user", "감사합니다. 잘 부탁해요!", "2026-05-10T11:06:00Z"),
          new DemoMessageResponse(
              "msg-21", "assistant", "감사합니다! 즐거운 하루 되시길 바랍니다!", "2026-05-10T11:06:30Z"));

  private static final DemoExecutionResponse HOTEL_EXECUTION =
      new DemoExecutionResponse(
          "exec-3",
          STATE_COMPLETED,
          STATE_COMPLETED,
          STATE_COMPLETED,
          "리조트 객실 예약 가능 여부 및 예약 진행 문의",
          Map.of(
              "hotel_name",
              "인디고발리",
              "check_in_date",
              "대체 ▲▲일",
              "stay_nights",
              2,
              "room_type",
              "클래식룸",
              "promotion_type",
              "1+1",
              "pickup_area",
              "공항"),
          List.of(
              "guest_names_ko_en",
              "guest_birth_dates",
              "representative_email",
              "representative_phone",
              "flight_number"),
          List.of(
              new DemoPolicyHitResponse(
                  "ROOM_AVAILABILITY_REQUIRED", "객실 가능 여부 확인 필요", "PASS", "필수 예약 조건 확보 후 가능 여부 확인"),
              new DemoPolicyHitResponse(
                  "ALTERNATIVE_ROOM_OFFER", "요청 객실 불가 시 대안 객실 제안", "PASS", "씨브리즈룸 불가 후 클래식룸 대안 제안"),
              new DemoPolicyHitResponse(
                  "CLASSIC_ROOM_PROMO_PRICE",
                  "클래식룸 1+1 특가 안내",
                  "PASS",
                  "2박 360달러, 성인 2인 조식과 세금 포함"),
              new DemoPolicyHitResponse(
                  "AIRPORT_PICKUP_POLICY", "공항 픽업 안내", "PASS", "공항 픽업 무료, 우붓 지역 15달러 안내"),
              new DemoPolicyHitResponse(
                  "POST_BOOKING_BENEFIT", "예약 완료 후 혜택 안내", "PASS", "발리 한국어 지도와 맛집 리스트 제공 안내")),
          List.of(
              new DemoRiskHitResponse(
                  "PERSONAL_INFO_COLLECTION",
                  "개인정보 수집 필요",
                  "MEDIUM",
                  "이름, 생년월일, 이메일, 연락처는 이메일 제출 방식으로 안내"),
              new DemoRiskHitResponse(
                  "AVAILABILITY_MISMATCH",
                  "예약 가능 여부 오인 가능성",
                  "LOW",
                  "현재 기준 객실 가능 여부와 대안 객실을 명확히 안내")));

  private static final List<DemoDecisionLogResponse> HOTEL_DECISION_LOGS =
      List.of(
          new DemoDecisionLogResponse(
              "log-9",
              1,
              "msg-8",
              STATE_INTENT_DETECTED,
              STATE_INITIAL,
              STATE_INTENT_DETECTED,
              DECISION_ALLOW,
              0.96,
              "인디고발리 객실 예약 가능 여부 문의 감지"),
          new DemoDecisionLogResponse(
              "log-10",
              2,
              "msg-8",
              "SLOT_FILLED",
              STATE_INTENT_DETECTED,
              STATE_SLOT_COLLECTING,
              DECISION_ALLOW,
              0.92,
              "숙소명, 체크인 날짜, 숙박 일수, 객실 타입, 프로모션 조건 수집"),
          new DemoDecisionLogResponse(
              "log-11",
              3,
              "msg-9",
              "POLICY_CHECKED",
              STATE_SLOT_COLLECTING,
              STATE_AVAILABILITY_CHECKING,
              DECISION_ALLOW,
              1.0,
              "씨브리즈룸 예약 불가 안내"),
          new DemoDecisionLogResponse(
              "log-12",
              4,
              "msg-10",
              "STATE_TRANSITIONED",
              STATE_AVAILABILITY_CHECKING,
              STATE_SLOT_COLLECTING,
              DECISION_ALLOW,
              0.87,
              "고객이 대체 일정 가능 여부를 다시 문의"),
          new DemoDecisionLogResponse(
              "log-13",
              5,
              "msg-11",
              "POLICY_CHECKED",
              STATE_SLOT_COLLECTING,
              STATE_AVAILABILITY_CHECKING,
              DECISION_ALLOW,
              1.0,
              "대체 일정도 예약 불가 안내"),
          new DemoDecisionLogResponse(
              "log-14",
              6,
              "msg-12",
              "SLOT_FILLED",
              STATE_AVAILABILITY_CHECKING,
              STATE_SLOT_COLLECTING,
              DECISION_ALLOW,
              0.9,
              "고객이 클래식룸 대안 가능 여부 문의"),
          new DemoDecisionLogResponse(
              "log-15",
              7,
              "msg-13",
              "POLICY_CHECKED",
              STATE_SLOT_COLLECTING,
              STATE_ALTERNATIVE_OFFERING,
              DECISION_ALLOW,
              0.98,
              "클래식룸 1+1 특가와 예약 가능 여부 안내"),
          new DemoDecisionLogResponse(
              "log-16",
              8,
              "msg-14",
              "STATE_TRANSITIONED",
              STATE_ALTERNATIVE_OFFERING,
              STATE_RESERVATION_GUIDE,
              DECISION_ALLOW,
              0.93,
              "고객이 예약 진행 방법 문의"),
          new DemoDecisionLogResponse(
              "log-17",
              9,
              "msg-15",
              "RISK_CHECKED",
              STATE_RESERVATION_GUIDE,
              STATE_RESERVATION_GUIDE,
              DECISION_ALLOW,
              0.86,
              "예약 진행을 위한 개인정보 수집 필요 안내"),
          new DemoDecisionLogResponse(
              "log-18",
              10,
              "msg-16",
              "POLICY_CHECKED",
              STATE_RESERVATION_GUIDE,
              STATE_PICKUP_GUIDE,
              DECISION_ALLOW,
              0.89,
              "고객이 공항 픽업 조건 문의"),
          new DemoDecisionLogResponse(
              "log-19",
              11,
              "msg-17",
              "POLICY_CHECKED",
              STATE_PICKUP_GUIDE,
              STATE_PICKUP_GUIDE,
              DECISION_ALLOW,
              0.97,
              "공항 무료 픽업 및 우붓 지역 픽업 비용 안내"),
          new DemoDecisionLogResponse(
              "log-20",
              12,
              "msg-18",
              "POLICY_CHECKED",
              STATE_PICKUP_GUIDE,
              STATE_BENEFIT_GUIDE,
              DECISION_ALLOW,
              0.9,
              "고객이 예약 후 혜택 문의"),
          new DemoDecisionLogResponse(
              "log-21",
              13,
              "msg-19",
              "ANSWER_GENERATED",
              STATE_BENEFIT_GUIDE,
              STATE_BENEFIT_GUIDE,
              DECISION_ALLOW,
              0.95,
              "발리 한국어 지도와 맛집 리스트 혜택 안내"),
          new DemoDecisionLogResponse(
              "log-22",
              14,
              "msg-20",
              "SESSION_COMPLETED",
              STATE_BENEFIT_GUIDE,
              STATE_COMPLETED,
              DECISION_ALLOW,
              0.94,
              "고객 감사 인사 후 추가 문의 없음"),
          new DemoDecisionLogResponse(
              "log-23",
              15,
              "msg-21",
              "ANSWER_GENERATED",
              STATE_COMPLETED,
              STATE_COMPLETED,
              DECISION_ALLOW,
              0.95,
              "최종 인사 응답 생성"));

  private static final DemoChatWorkflowResponse HOTEL_CHAT_WORKFLOW =
      new DemoChatWorkflowResponse(
          HOTEL_DOMAIN_PACK,
          HOTEL_WORKFLOW,
          HOTEL_CHAT_SESSION,
          HOTEL_MESSAGES,
          HOTEL_EXECUTION,
          HOTEL_DECISION_LOGS);

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
