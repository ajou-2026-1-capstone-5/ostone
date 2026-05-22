package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.workflowruntime.application.dto.LlmToolPolicyResponse;
import com.init.workflowruntime.application.dto.WorkflowAdvanceResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("WorkflowRuntimeService")
class WorkflowRuntimeServiceTest {

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private WorkflowExecutionRepository workflowExecutionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock private WorkflowPolicyRuntimeService workflowPolicyRuntimeService;

  private WorkflowRuntimeService service;
  private ObjectMapper objectMapper;

  @BeforeEach
  void setUp() {
    objectMapper = new ObjectMapper();
    service =
        new WorkflowRuntimeService(
            chatSessionRepository,
            workflowExecutionRepository,
            workflowDefinitionRepository,
            workflowPolicyRuntimeService,
            objectMapper);
    given(workflowPolicyRuntimeService.buildPolicySnapshot(null))
        .willReturn(objectMapper.createObjectNode());
  }

  @Test
  @DisplayName("advance: slot_present 조건이 충족되지 않으면 현재 state에 머물며 ASK_SLOT을 반환한다")
  void should_askSlotAndKeepCurrentState_when_slotValueMissing() {
    ChatSession session = createSession(1L, 10L, 101L);
    WorkflowExecution execution = createExecution(50L, 1L, 150L, "collect_reservation_no", "{}");
    WorkflowDefinition workflow = createWorkflow(150L, 101L, reservationCancelGraphJson());

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.of(execution));
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(150L, 101L))
        .willReturn(Optional.of(workflow));

    WorkflowAdvanceResponse result = service.advance(1L);

    assertThat(result.actionType()).isEqualTo("ASK_SLOT");
    assertThat(result.currentState()).isEqualTo("collect_reservation_no");
    assertThat(result.missingSlotCodes()).containsExactly("reservation_no");
    assertThat(execution.getCurrentState()).isEqualTo("collect_reservation_no");
    verify(workflowExecutionRepository, never()).save(execution);
  }

  @Test
  @DisplayName("advance: slot_present 조건이 충족되면 해당 edge target으로 currentState를 전이한다")
  void should_advanceToTargetState_when_slotConditionMatches() {
    ChatSession session = createSession(1L, 10L, 101L);
    WorkflowExecution execution =
        createExecution(50L, 1L, 150L, "collect_reservation_no", "{\"reservation_no\":\"R-1234\"}");
    WorkflowDefinition workflow = createWorkflow(150L, 101L, reservationCancelGraphJson());

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.of(execution));
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(150L, 101L))
        .willReturn(Optional.of(workflow));
    given(workflowExecutionRepository.save(execution)).willReturn(execution);

    WorkflowAdvanceResponse result = service.advance(1L);

    assertThat(result.actionType()).isEqualTo("ADVANCE");
    assertThat(result.previousState()).isEqualTo("collect_reservation_no");
    assertThat(result.currentState()).isEqualTo("confirm_cancel");
    assertThat(result.edgeId()).isEqualTo("e_collect_confirm");
    assertThat(result.condition().path("type").asText()).isEqualTo("slot_present");
    assertThat(result.transitionPolicy()).isNull();
    assertThat(execution.getCurrentState()).isEqualTo("confirm_cancel");
    verify(workflowExecutionRepository).save(execution);
  }

  @Test
  @DisplayName("advance: 매칭 조건이 없으면 default edge를 사용해 handoff state로 전이한다")
  void should_useDefaultEdgeForHandoff_when_noConditionMatches() {
    ChatSession session = createSession(1L, 10L, 101L);
    WorkflowExecution execution =
        createExecution(50L, 1L, 150L, "cancel_decision", "{\"auto_cancel_available\":false}");
    WorkflowDefinition workflow = createWorkflow(150L, 101L, reservationCancelGraphJson());

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.of(execution));
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(150L, 101L))
        .willReturn(Optional.of(workflow));
    given(workflowExecutionRepository.save(execution)).willReturn(execution);

    WorkflowAdvanceResponse result = service.advance(1L);

    assertThat(result.actionType()).isEqualTo("HANDOFF");
    assertThat(result.currentState()).isEqualTo("handoff");
    assertThat(result.currentNodeType()).isEqualTo("HANDOFF");
    assertThat(result.edgeId()).isEqualTo("e_decision_handoff");
    assertThat(execution.getCurrentState()).isEqualTo("handoff");
  }

  @Test
  @DisplayName("advance: 현재 노드 policy 평가 결과가 맞으면 policy_hit edge로 즉시 전이한다")
  void should_advanceByPolicyHitEdge_when_currentNodePolicyMatches() throws Exception {
    ChatSession session = createSession(1L, 10L, 101L);
    WorkflowExecution execution = createExecution(50L, 1L, 150L, "policy_check", "{}");
    WorkflowDefinition workflow = createWorkflow(150L, 101L, policyHitGraphJson());
    LlmToolPolicyResponse policyResponse =
        new LlmToolPolicyResponse(
            300L,
            "refund_policy",
            "환불 정책",
            "환불 가능 조건",
            "HIGH",
            objectMapper.createObjectNode(),
            objectMapper.createObjectNode(),
            objectMapper.createArrayNode(),
            objectMapper.createObjectNode(),
            "ACTIVE",
            "policy_check",
            true,
            List.of(),
            "policy condition matched");
    JsonNode policySnapshot =
        objectMapper.readTree("{\"hits\":[{\"policyCode\":\"refund_policy\"}]}");

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.of(execution));
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(150L, 101L))
        .willReturn(Optional.of(workflow));
    given(
            workflowPolicyRuntimeService.evaluateNodePolicy(
                eq(101L),
                eq(new WorkflowRuntimeGraph.RuntimeNode("policy_check", "ACTION", "refund_policy")),
                any(),
                eq(execution)))
        .willReturn(policyResponse);
    given(workflowPolicyRuntimeService.buildPolicySnapshot(policyResponse))
        .willReturn(policySnapshot);
    given(workflowExecutionRepository.save(execution)).willReturn(execution);

    WorkflowAdvanceResponse result = service.advance(1L);

    assertThat(result.actionType()).isEqualTo("HANDOFF");
    assertThat(result.edgeId()).isEqualTo("e_policy_handoff");
    assertThat(result.currentState()).isEqualTo("handoff");
    assertThat(result.condition().path("type").asText()).isEqualTo("policy_hit");
    assertThat(result.transitionPolicy()).isEqualTo(policyResponse);
    assertThat(result.currentPolicy()).isNull();
    assertThat(execution.getCurrentState()).isEqualTo("handoff");
  }

  private ChatSession createSession(Long id, Long workspaceId, Long versionId) {
    ChatSession session =
        ChatSession.create(workspaceId, versionId, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", id);
    return session;
  }

  private WorkflowExecution createExecution(
      Long id, Long sessionId, Long workflowId, String currentState, String slotValuesJson) {
    WorkflowExecution execution = WorkflowExecution.create(sessionId);
    ReflectionTestUtils.setField(execution, "id", id);
    execution.assignIntentWorkflow(70L, workflowId, currentState);
    execution.replaceSlotValuesJson(slotValuesJson);
    return execution;
  }

  private WorkflowDefinition createWorkflow(Long id, Long versionId, String graphJson) {
    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            versionId,
            "reservation_cancel",
            "예약 취소",
            "예약 취소 workflow",
            graphJson,
            "start",
            "[\"done\"]",
            "[]",
            "{}");
    ReflectionTestUtils.setField(workflow, "id", id);
    return workflow;
  }

  private String reservationCancelGraphJson() {
    return """
        {
          "direction": "LR",
          "nodes": [
            {"id": "start", "type": "START", "label": "시작"},
            {
              "id": "collect_reservation_no",
              "type": "ACTION",
              "label": "예약번호 확인",
              "policyRef": "cancel_policy"
            },
            {
              "id": "confirm_cancel",
              "type": "ACTION",
              "label": "취소 가능 여부 확인",
              "policyRef": "cancel_policy"
            },
            {"id": "cancel_decision", "type": "DECISION", "label": "취소 처리 분기"},
            {"id": "handoff", "type": "HANDOFF", "label": "상담사 이관"},
            {"id": "done", "type": "TERMINAL", "label": "종료"}
          ],
          "edges": [
            {
              "id": "e_start_collect",
              "from": "start",
              "to": "collect_reservation_no",
              "condition": {"type": "always"}
            },
            {
              "id": "e_collect_confirm",
              "from": "collect_reservation_no",
              "to": "confirm_cancel",
              "label": "예약번호 있음",
              "condition": {"type": "slot_present", "slotCode": "reservation_no"}
            },
            {
              "id": "e_confirm_decision",
              "from": "confirm_cancel",
              "to": "cancel_decision",
              "condition": {"type": "always"}
            },
            {
              "id": "e_decision_done",
              "from": "cancel_decision",
              "to": "done",
              "label": "자동 처리 가능",
              "condition": {
                "type": "slot_equals",
                "slotCode": "auto_cancel_available",
                "value": true
              }
            },
            {
              "id": "e_decision_handoff",
              "from": "cancel_decision",
              "to": "handoff",
              "label": "이관 필요",
              "condition": {"type": "default"}
            }
          ]
        }
        """;
  }

  private String policyHitGraphJson() {
    return """
        {
          "direction": "LR",
          "nodes": [
            {
              "id": "policy_check",
              "type": "ACTION",
              "label": "정책 확인",
              "policyRef": "refund_policy"
            },
            {"id": "handoff", "type": "HANDOFF", "label": "상담사 이관"},
            {"id": "answer", "type": "ANSWER", "label": "일반 답변"}
          ],
          "edges": [
            {
              "id": "e_policy_handoff",
              "from": "policy_check",
              "to": "handoff",
              "condition": {"type": "policy_hit", "policyCode": "refund_policy"}
            },
            {
              "id": "e_policy_answer",
              "from": "policy_check",
              "to": "answer",
              "condition": {"type": "default"}
            }
          ]
        }
        """;
  }
}
