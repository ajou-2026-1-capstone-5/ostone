package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.workflowruntime.application.dto.LlmToolPolicyResponse;
import com.init.workflowruntime.domain.WorkflowExecution;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("WorkflowPolicyRuntimeService")
class WorkflowPolicyRuntimeServiceTest {

  @Mock private PolicyDefinitionRepository policyDefinitionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;

  private WorkflowPolicyRuntimeService service;

  @BeforeEach
  void setUp() {
    service =
        new WorkflowPolicyRuntimeService(
            policyDefinitionRepository, workflowDefinitionRepository, new ObjectMapper());
  }

  @Test
  @DisplayName("evaluateCurrentPolicy: 현재 node의 policyRef 정책을 slot 값으로 평가한다")
  void should_evaluateCurrentPolicyWithSlotValues() {
    WorkflowExecution execution =
        createExecution(50L, 1L, 150L, "confirm_cancel", "{\"reservation_no\":\"R-1234\"}");
    WorkflowDefinition workflow = createWorkflow(150L, 101L, graphJson());
    PolicyDefinition policy = createPolicy(10L, 101L);

    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(150L, 101L))
        .willReturn(Optional.of(workflow));
    given(policyDefinitionRepository.findByDomainPackVersionIdAndPolicyCode(101L, "cancel_policy"))
        .willReturn(Optional.of(policy));

    LlmToolPolicyResponse result =
        service.evaluateCurrentPolicy(
            101L, execution, new ObjectMapper().createObjectNode().put("reservation_no", "R-1234"));
    JsonNode snapshot = service.buildPolicySnapshot(result);

    assertThat(result.policyCode()).isEqualTo("cancel_policy");
    assertThat(result.nodeId()).isEqualTo("confirm_cancel");
    assertThat(result.matched()).isTrue();
    assertThat(result.missingSlotCodes()).isEmpty();
    assertThat(result.action().path("answerGuide").asText()).isEqualTo("예약 취소 가능 여부를 안내한다.");
    assertThat(snapshot.path("hits").get(0).path("policyCode").asText()).isEqualTo("cancel_policy");
  }

  @Test
  @DisplayName("evaluateCurrentPolicy: 정책 조건에 필요한 slot이 없으면 missingSlotCodes를 반환한다")
  void should_returnMissingSlots_when_policyConditionBlocked() {
    WorkflowExecution execution = createExecution(50L, 1L, 150L, "confirm_cancel", "{}");
    WorkflowDefinition workflow = createWorkflow(150L, 101L, graphJson());
    PolicyDefinition policy = createPolicy(10L, 101L);

    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(150L, 101L))
        .willReturn(Optional.of(workflow));
    given(policyDefinitionRepository.findByDomainPackVersionIdAndPolicyCode(101L, "cancel_policy"))
        .willReturn(Optional.of(policy));

    LlmToolPolicyResponse result =
        service.evaluateCurrentPolicy(101L, execution, new ObjectMapper().createObjectNode());

    assertThat(result.matched()).isFalse();
    assertThat(result.missingSlotCodes()).containsExactly("reservation_no");
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
            "{}",
            1L,
            true,
            "{}");
    ReflectionTestUtils.setField(workflow, "id", id);
    return workflow;
  }

  private PolicyDefinition createPolicy(Long id, Long versionId) {
    PolicyDefinition policy =
        PolicyDefinition.create(
            versionId,
            "cancel_policy",
            "예약 취소 정책",
            "예약번호 기준 취소 가능 여부를 판단한다.",
            "HIGH",
            "{\"type\":\"slot_present\",\"slotCode\":\"reservation_no\"}",
            "{\"answerGuide\":\"예약 취소 가능 여부를 안내한다.\"}",
            "[]",
            "{}");
    ReflectionTestUtils.setField(policy, "id", id);
    return policy;
  }

  private String graphJson() {
    return """
        {
          "direction": "LR",
          "nodes": [
            {"id": "start", "type": "START", "label": "시작"},
            {
              "id": "confirm_cancel",
              "type": "ACTION",
              "label": "취소 가능 여부 확인",
              "policyRef": "cancel_policy"
            },
            {"id": "done", "type": "TERMINAL", "label": "종료"}
          ],
          "edges": [
            {
              "id": "e_start_confirm",
              "from": "start",
              "to": "confirm_cancel",
              "condition": {"type": "always"}
            },
            {
              "id": "e_confirm_done",
              "from": "confirm_cancel",
              "to": "done",
              "condition": {"type": "always"}
            }
          ]
        }
        """;
  }
}
