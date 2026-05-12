package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefInvalidCharsException;
import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefNotFoundException;
import com.init.domainpack.application.exception.WorkflowDefinitionNotFoundException;
import com.init.domainpack.application.exception.WorkflowTransitionActionNotEditableException;
import com.init.domainpack.application.exception.WorkflowTransitionConditionNotEditableException;
import com.init.domainpack.application.exception.WorkflowTransitionNotFoundException;
import com.init.domainpack.application.exception.WorkflowTransitionOutcomeEmptyException;
import com.init.domainpack.application.exception.WorkflowTransitionOutcomeNotEditableException;
import com.init.domainpack.application.exception.WorkflowTransitionOutcomeStateInvalidCharsException;
import com.init.domainpack.application.exception.WorkflowTransitionPatchEmptyException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("UpdateWorkflowTransitionUseCase")
class UpdateWorkflowTransitionUseCaseTest {

  private static final Long WORKSPACE_ID = 1L;
  private static final Long PACK_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long WORKFLOW_ID = 3001L;
  private static final Long USER_ID = 10L;

  private static final String GRAPH =
      "{\"direction\":\"LR\","
          + "\"nodes\":["
          + "{\"id\":\"start\",\"type\":\"START\"},"
          + "{\"id\":\"check\",\"type\":\"DECISION\"},"
          + "{\"id\":\"action\",\"type\":\"ACTION\",\"policyRef\":\"policy_old\"},"
          + "{\"id\":\"end_ok\",\"type\":\"TERMINAL\",\"state\":\"approved\",\"label\":\"승인\"},"
          + "{\"id\":\"end_reject\",\"type\":\"TERMINAL\",\"state\":\"rejected\",\"label\":\"거절\"}],"
          + "\"edges\":["
          + "{\"id\":\"e_start_check\",\"from\":\"start\",\"to\":\"check\"},"
          + "{\"id\":\"e_check_action\",\"from\":\"check\",\"to\":\"action\",\"label\":\"가능\"},"
          + "{\"id\":\"e_check_reject\",\"from\":\"check\",\"to\":\"end_reject\",\"label\":\"불가능\"},"
          + "{\"id\":\"e_action_end\",\"from\":\"action\",\"to\":\"end_ok\"}]}";

  private static final String SHARED_ACTION_TARGET_GRAPH =
      "{\"direction\":\"LR\","
          + "\"nodes\":["
          + "{\"id\":\"start\",\"type\":\"START\"},"
          + "{\"id\":\"check\",\"type\":\"DECISION\"},"
          + "{\"id\":\"action\",\"type\":\"ACTION\",\"policyRef\":\"policy_old\"},"
          + "{\"id\":\"end\",\"type\":\"TERMINAL\",\"state\":\"done\",\"label\":\"완료\"}],"
          + "\"edges\":["
          + "{\"id\":\"e_start_check\",\"from\":\"start\",\"to\":\"check\"},"
          + "{\"id\":\"e_start_action\",\"from\":\"start\",\"to\":\"action\"},"
          + "{\"id\":\"e_check_action\",\"from\":\"check\",\"to\":\"action\",\"label\":\"가능\"},"
          + "{\"id\":\"e_action_end\",\"from\":\"action\",\"to\":\"end\"}]}";

  private static final String SHARED_TERMINAL_TARGET_GRAPH =
      "{\"direction\":\"LR\","
          + "\"nodes\":["
          + "{\"id\":\"start\",\"type\":\"START\"},"
          + "{\"id\":\"check\",\"type\":\"DECISION\"},"
          + "{\"id\":\"end\",\"type\":\"TERMINAL\",\"state\":\"done\",\"label\":\"완료\"}],"
          + "\"edges\":["
          + "{\"id\":\"e_start_check\",\"from\":\"start\",\"to\":\"check\"},"
          + "{\"id\":\"e_start_end\",\"from\":\"start\",\"to\":\"end\"},"
          + "{\"id\":\"e_check_end\",\"from\":\"check\",\"to\":\"end\",\"label\":\"가능\"}]}";

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Mock private DomainPackValidator validator;
  @Mock private DomainPackVersionRepository versionRepository;
  @Mock private WorkflowDefinitionRepository workflowRepository;

  private UpdateWorkflowTransitionUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new UpdateWorkflowTransitionUseCase(validator, versionRepository, workflowRepository);
  }

  @Test
  @DisplayName("DECISION -> ACTION transition에서 condition과 action을 수정한다")
  void should_updateConditionAndAction_when_decisionToActionTransition() throws Exception {
    // given
    WorkflowDefinition workflow = stubDraftWorkflow();
    given(workflowRepository.save(any())).willReturn(workflow);

    UpdateWorkflowTransitionCommand command =
        command(
            "e_check_action",
            new UpdateWorkflowTransitionCommand.ConditionPatch("  가능함  "),
            new UpdateWorkflowTransitionCommand.ActionPatch("policy_new"),
            null);

    // when
    WorkflowTransitionDetail result = useCase.execute(command);

    // then
    assertThat(result.label()).isEqualTo("가능함");
    assertThat(result.toPolicyRef()).isEqualTo("policy_new");
    assertThat(result.condition().editable()).isTrue();
    assertThat(result.action().editable()).isTrue();

    JsonNode graph = objectMapper.readTree(workflow.getGraphJson());
    assertThat(findEdge(graph, "e_check_action").path("label").asText()).isEqualTo("가능함");
    assertThat(findNode(graph, "action").path("policyRef").asText()).isEqualTo("policy_new");
    verify(validator).validatePolicyCodes(eq(VERSION_ID), eq(Set.of("policy_new")));
    verify(workflowRepository).save(workflow);
  }

  @Test
  @DisplayName("DECISION -> TERMINAL transition에서 outcome.state와 outcome.label을 수정한다")
  void should_updateOutcome_when_decisionToTerminalTransition() throws Exception {
    // given
    WorkflowDefinition workflow = stubDraftWorkflow();
    given(workflowRepository.save(any())).willReturn(workflow);

    UpdateWorkflowTransitionCommand command =
        command(
            "e_check_reject",
            new UpdateWorkflowTransitionCommand.ConditionPatch("보류"),
            null,
            new UpdateWorkflowTransitionCommand.OutcomePatch("pending", "보류 처리"));

    // when
    WorkflowTransitionDetail result = useCase.execute(command);

    // then
    assertThat(result.condition().label()).isEqualTo("보류");
    assertThat(result.outcome().editable()).isTrue();
    assertThat(result.outcome().state()).isEqualTo("pending");
    assertThat(result.outcome().label()).isEqualTo("보류 처리");

    JsonNode graph = objectMapper.readTree(workflow.getGraphJson());
    assertThat(findNode(graph, "end_reject").path("state").asText()).isEqualTo("pending");
    assertThat(findNode(graph, "end_reject").path("label").asText()).isEqualTo("보류 처리");
  }

  @Test
  @DisplayName("outcome.state만 보내면 label은 유지한다")
  void should_keepOutcomeLabel_when_onlyStateProvided() throws Exception {
    // given
    WorkflowDefinition workflow = stubDraftWorkflow();
    given(workflowRepository.save(any())).willReturn(workflow);

    // when
    useCase.execute(
        command(
            "e_check_reject",
            null,
            null,
            new UpdateWorkflowTransitionCommand.OutcomePatch("failed", null)));

    // then
    JsonNode terminal = findNode(objectMapper.readTree(workflow.getGraphJson()), "end_reject");
    assertThat(terminal.path("state").asText()).isEqualTo("failed");
    assertThat(terminal.path("label").asText()).isEqualTo("거절");
  }

  @Test
  @DisplayName("outcome.label만 보내면 state는 유지한다")
  void should_keepOutcomeState_when_onlyLabelProvided() throws Exception {
    // given
    WorkflowDefinition workflow = stubDraftWorkflow();
    given(workflowRepository.save(any())).willReturn(workflow);

    // when
    WorkflowTransitionDetail result =
        useCase.execute(
            command(
                "e_check_reject",
                null,
                null,
                new UpdateWorkflowTransitionCommand.OutcomePatch(null, "검토 필요")));

    // then
    assertThat(result.outcome().state()).isEqualTo("rejected");
    assertThat(result.outcome().label()).isEqualTo("검토 필요");

    JsonNode terminal = findNode(objectMapper.readTree(workflow.getGraphJson()), "end_reject");
    assertThat(terminal.path("state").asText()).isEqualTo("rejected");
    assertThat(terminal.path("label").asText()).isEqualTo("검토 필요");
  }

  @Test
  @DisplayName("빈 PATCH 요청이면 WORKFLOW_TRANSITION_PATCH_EMPTY")
  void should_WORKFLOW_TRANSITION_PATCH_EMPTY_when_emptyPatch() {
    assertThatThrownBy(() -> useCase.execute(command("e_check_action", null, null, null)))
        .isInstanceOf(WorkflowTransitionPatchEmptyException.class);

    verify(workflowRepository, never()).save(any());
  }

  @Test
  @DisplayName("non-DECISION edge에 condition 요청 시 WORKFLOW_TRANSITION_CONDITION_NOT_EDITABLE")
  void should_WORKFLOW_TRANSITION_CONDITION_NOT_EDITABLE_when_nonDecisionEdge() {
    stubDraftWorkflow();

    assertThatThrownBy(
            () ->
                useCase.execute(
                    command(
                        "e_action_end",
                        new UpdateWorkflowTransitionCommand.ConditionPatch("완료"),
                        null,
                        null)))
        .isInstanceOf(WorkflowTransitionConditionNotEditableException.class);
  }

  @Test
  @DisplayName("non-ACTION 목적지에 action 요청 시 WORKFLOW_TRANSITION_ACTION_NOT_EDITABLE")
  void should_WORKFLOW_TRANSITION_ACTION_NOT_EDITABLE_when_toNodeIsNotAction() {
    stubDraftWorkflow();

    assertThatThrownBy(
            () ->
                useCase.execute(
                    command(
                        "e_check_reject",
                        null,
                        new UpdateWorkflowTransitionCommand.ActionPatch("policy_new"),
                        null)))
        .isInstanceOf(WorkflowTransitionActionNotEditableException.class);
  }

  @Test
  @DisplayName("non-TERMINAL 목적지에 outcome 요청 시 WORKFLOW_TRANSITION_OUTCOME_NOT_EDITABLE")
  void should_WORKFLOW_TRANSITION_OUTCOME_NOT_EDITABLE_when_toNodeIsNotTerminal() {
    stubDraftWorkflow();

    assertThatThrownBy(
            () ->
                useCase.execute(
                    command(
                        "e_check_action",
                        null,
                        null,
                        new UpdateWorkflowTransitionCommand.OutcomePatch("done", null))))
        .isInstanceOf(WorkflowTransitionOutcomeNotEditableException.class);
  }

  @Test
  @DisplayName("outcome 내부가 비어 있으면 WORKFLOW_TRANSITION_OUTCOME_EMPTY")
  void should_WORKFLOW_TRANSITION_OUTCOME_EMPTY_when_outcomeEmpty() {
    assertThatThrownBy(
            () ->
                useCase.execute(
                    command(
                        "e_check_reject",
                        null,
                        null,
                        new UpdateWorkflowTransitionCommand.OutcomePatch(null, null))))
        .isInstanceOf(WorkflowTransitionOutcomeEmptyException.class);
  }

  @Test
  @DisplayName("transitionId 패턴 위반 시 DB 조회 전에 VALIDATION_ERROR")
  void should_VALIDATION_ERROR_beforeRepositoryLookup_when_transitionIdInvalid() {
    assertThatThrownBy(
            () ->
                useCase.execute(
                    command(
                        "edge.with.dot",
                        new UpdateWorkflowTransitionCommand.ConditionPatch("가능"),
                        null,
                        null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("transitionId");

    verify(versionRepository, never()).findByIdForUpdate(any());
    verify(workflowRepository, never()).findByIdAndDomainPackVersionIdForUpdate(any(), any());
    verify(workflowRepository, never()).save(any());
  }

  @Test
  @DisplayName("action.policyRef 패턴 위반 시 WORKFLOW_ACTION_NODE_POLICY_REF_INVALID_CHARS")
  void should_WORKFLOW_ACTION_NODE_POLICY_REF_INVALID_CHARS_when_policyRefInvalidChars() {
    stubDraftWorkflow();

    assertThatThrownBy(
            () ->
                useCase.execute(
                    command(
                        "e_check_action",
                        null,
                        new UpdateWorkflowTransitionCommand.ActionPatch("policy ref"),
                        null)))
        .isInstanceOf(WorkflowActionNodePolicyRefInvalidCharsException.class);

    verify(workflowRepository, never()).save(any());
  }

  @Test
  @DisplayName("공유 ACTION 목적지 transition에는 action을 수정할 수 없다")
  void should_WORKFLOW_TRANSITION_TARGET_SHARED_when_actionTargetHasMultipleInboundEdges() {
    stubDraftWorkflow(SHARED_ACTION_TARGET_GRAPH);
    UpdateWorkflowTransitionCommand command =
        command(
            "e_check_action",
            null,
            new UpdateWorkflowTransitionCommand.ActionPatch("policy_new"),
            null);

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(BadRequestException.class)
        .extracting("code")
        .isEqualTo("WORKFLOW_TRANSITION_TARGET_SHARED");

    verify(workflowRepository, never()).save(any());
  }

  @Test
  @DisplayName("공유 TERMINAL 목적지 transition에는 outcome을 수정할 수 없다")
  void should_WORKFLOW_TRANSITION_TARGET_SHARED_when_outcomeTargetHasMultipleInboundEdges() {
    stubDraftWorkflow(SHARED_TERMINAL_TARGET_GRAPH);
    UpdateWorkflowTransitionCommand command =
        command(
            "e_check_end",
            null,
            null,
            new UpdateWorkflowTransitionCommand.OutcomePatch("pending", null));

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(BadRequestException.class)
        .extracting("code")
        .isEqualTo("WORKFLOW_TRANSITION_TARGET_SHARED");

    verify(workflowRepository, never()).save(any());
  }

  @Test
  @DisplayName("outcome.state 패턴 위반 시 WORKFLOW_TRANSITION_OUTCOME_STATE_INVALID_CHARS")
  void should_WORKFLOW_TRANSITION_OUTCOME_STATE_INVALID_CHARS_when_outcomeStateInvalidChars() {
    stubDraftWorkflow();

    assertThatThrownBy(
            () ->
                useCase.execute(
                    command(
                        "e_check_reject",
                        null,
                        null,
                        new UpdateWorkflowTransitionCommand.OutcomePatch("검토 필요", null))))
        .isInstanceOf(WorkflowTransitionOutcomeStateInvalidCharsException.class);

    verify(workflowRepository, never()).save(any());
  }

  @Test
  @DisplayName("action section이 없어도 전체 ACTION node policyRef 존재 검증을 수행한다")
  void should_validateAllPolicyRefs_when_actionSectionMissing() {
    // given
    stubDraftWorkflow();
    doThrow(new WorkflowActionNodePolicyRefNotFoundException("policy_old"))
        .when(validator)
        .validatePolicyCodes(eq(VERSION_ID), eq(Set.of("policy_old")));

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    command(
                        "e_check_reject",
                        new UpdateWorkflowTransitionCommand.ConditionPatch("보류"),
                        null,
                        null)))
        .isInstanceOf(WorkflowActionNodePolicyRefNotFoundException.class);

    verify(workflowRepository, never()).save(any());
  }

  @Test
  @DisplayName("PUBLISHED version이면 WORKFLOW_NOT_EDITABLE")
  void should_WORKFLOW_NOT_EDITABLE_when_publishedVersion() {
    given(versionRepository.findByIdForUpdate(VERSION_ID))
        .willReturn(
            Optional.of(
                DomainPackVersion.ofForTest(
                    VERSION_ID, PACK_ID, DomainPackVersion.STATUS_PUBLISHED)));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    command(
                        "e_check_action",
                        new UpdateWorkflowTransitionCommand.ConditionPatch("가능함"),
                        null,
                        null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("DRAFT");
  }

  @Test
  @DisplayName("transitionId 미존재이면 WORKFLOW_TRANSITION_NOT_FOUND")
  void should_WORKFLOW_TRANSITION_NOT_FOUND_when_transitionMissing() {
    stubDraftWorkflow();

    assertThatThrownBy(
            () ->
                useCase.execute(
                    command(
                        "missing_edge",
                        new UpdateWorkflowTransitionCommand.ConditionPatch("가능함"),
                        null,
                        null)))
        .isInstanceOf(WorkflowTransitionNotFoundException.class);
  }

  @Test
  @DisplayName("workflowId 미존재이면 WORKFLOW_DEFINITION_NOT_FOUND")
  void should_WORKFLOW_DEFINITION_NOT_FOUND_when_workflowMissing() {
    given(versionRepository.findByIdForUpdate(VERSION_ID))
        .willReturn(
            Optional.of(
                DomainPackVersion.ofForTest(VERSION_ID, PACK_ID, DomainPackVersion.STATUS_DRAFT)));
    given(workflowRepository.findByIdAndDomainPackVersionIdForUpdate(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    command(
                        "e_check_action",
                        new UpdateWorkflowTransitionCommand.ConditionPatch("가능함"),
                        null,
                        null)))
        .isInstanceOf(WorkflowDefinitionNotFoundException.class);
  }

  @Test
  @DisplayName("수정 대상 version과 workflow는 for update 조회를 사용한다")
  void should_useForUpdateLookups_when_updateTransition() {
    // given
    WorkflowDefinition workflow = stubDraftWorkflow();
    given(workflowRepository.save(any())).willReturn(workflow);

    // when
    useCase.execute(
        command(
            "e_check_action",
            new UpdateWorkflowTransitionCommand.ConditionPatch("가능함"),
            null,
            null));

    // then
    verify(versionRepository).findByIdForUpdate(VERSION_ID);
    verify(versionRepository, never()).findById(VERSION_ID);
    verify(workflowRepository).findByIdAndDomainPackVersionIdForUpdate(WORKFLOW_ID, VERSION_ID);
    verify(workflowRepository, never()).findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID);
  }

  private UpdateWorkflowTransitionCommand command(
      String transitionId,
      UpdateWorkflowTransitionCommand.ConditionPatch condition,
      UpdateWorkflowTransitionCommand.ActionPatch action,
      UpdateWorkflowTransitionCommand.OutcomePatch outcome) {
    return new UpdateWorkflowTransitionCommand(
        WORKSPACE_ID,
        PACK_ID,
        VERSION_ID,
        WORKFLOW_ID,
        transitionId,
        USER_ID,
        condition,
        action,
        outcome);
  }

  private WorkflowDefinition stubDraftWorkflow() {
    return stubDraftWorkflow(GRAPH);
  }

  private WorkflowDefinition stubDraftWorkflow(String graph) {
    given(versionRepository.findByIdForUpdate(VERSION_ID))
        .willReturn(
            Optional.of(
                DomainPackVersion.ofForTest(VERSION_ID, PACK_ID, DomainPackVersion.STATUS_DRAFT)));
    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            VERSION_ID, "wf_refund", "환불 플로우", null, graph, "start", "[\"end_ok\"]", null, null);
    ReflectionTestUtils.setField(workflow, "id", WORKFLOW_ID);
    given(workflowRepository.findByIdAndDomainPackVersionIdForUpdate(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.of(workflow));
    return workflow;
  }

  private JsonNode findNode(JsonNode graph, String nodeId) {
    for (JsonNode node : graph.path("nodes")) {
      if (nodeId.equals(node.path("id").asText())) {
        return node;
      }
    }
    throw new AssertionError("node not found: " + nodeId);
  }

  private JsonNode findEdge(JsonNode graph, String edgeId) {
    for (JsonNode edge : graph.path("edges")) {
      if (edgeId.equals(edge.path("id").asText())) {
        return edge;
      }
    }
    throw new AssertionError("edge not found: " + edgeId);
  }
}
