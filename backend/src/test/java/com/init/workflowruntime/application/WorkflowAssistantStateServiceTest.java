package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.command.UpsertLlmToolSlotValueCommand;
import com.init.workflowruntime.application.dto.AssistantConversationState;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotResponse;
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
@DisplayName("WorkflowAssistantStateService")
class WorkflowAssistantStateServiceTest {

  @Mock private LlmToolService llmToolService;
  @Mock private WorkflowRuntimeService workflowRuntimeService;
  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private WorkflowExecutionRepository workflowExecutionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;

  private ObjectMapper objectMapper;
  private WorkflowAssistantStateService service;

  @BeforeEach
  void setUp() {
    objectMapper = new ObjectMapper();
    service =
        new WorkflowAssistantStateService(
            llmToolService,
            workflowRuntimeService,
            chatSessionRepository,
            workflowExecutionRepository,
            workflowDefinitionRepository,
            objectMapper);
  }

  @Test
  @DisplayName("inspect: workflow가 없으면 NEED_INTENT를 반환한다")
  void should_returnNeedIntent_when_workflowNotSelected() {
    given(llmToolService.getContext(any(GetLlmToolContextCommand.class))).willReturn(context(null));

    AssistantConversationState result = service.inspect(1L);

    assertThat(result.nextAction().type()).isEqualTo("NEED_INTENT");
    assertThat(result.allowedTools()).containsExactly("classify_intent");
    verify(workflowRuntimeService, never()).advance(1L);
  }

  @Test
  @DisplayName("inspect: ASK_SLOT action을 redacted DTO로 반환한다")
  void should_returnAskSlotStateWithoutInternalFields() throws JsonProcessingException {
    LlmToolContextResponse context = context(10L);
    givenRuntimeMetadata();
    given(llmToolService.getContext(any(GetLlmToolContextCommand.class)))
        .willReturn(context, context);
    given(workflowRuntimeService.advance(1L))
        .willReturn(
            advanceResponse(
                "collect_order", "collect_order", "ASK_SLOT", null, List.of("order_id")));

    AssistantConversationState result = service.inspect(1L);

    assertThat(result.workflow().currentStep()).isEqualTo("주문 확인");
    assertThat(result.nextAction().type()).isEqualTo("ASK_SLOT");
    assertThat(result.nextAction().slotCode()).isEqualTo("order_id");
    assertThat(result.nextAction().question()).isEqualTo("주문번호를 입력하세요");

    String serialized = objectMapper.writeValueAsString(result);
    assertThat(serialized)
        .doesNotContain("policy")
        .doesNotContain("risk")
        .doesNotContain("condition")
        .doesNotContain("graphJson")
        .doesNotContain("nodeId")
        .doesNotContain("edgeId")
        .doesNotContain("\"value\"");
  }

  @Test
  @DisplayName("updateSlot: 현재 요청 slot만 저장한 뒤 다음 상태를 반환한다")
  void should_updateOnlyRequestedSlot() {
    LlmToolContextResponse context = context(10L);
    givenRuntimeMetadata();
    given(llmToolService.getContext(any(GetLlmToolContextCommand.class)))
        .willReturn(context, context, context, context);
    given(workflowRuntimeService.advance(1L))
        .willReturn(
            advanceResponse(
                "collect_order", "collect_order", "ASK_SLOT", null, List.of("order_id")),
            advanceResponse("collect_order", "answer", "ANSWER", "edge-answer", List.of()));

    AssistantConversationState result = service.updateSlot(1L, "order_id", "A-100");

    assertThat(result.nextAction().type()).isEqualTo("ANSWER");
    verify(llmToolService)
        .upsertSlotValue(
            argThat(
                command ->
                    command instanceof UpsertLlmToolSlotValueCommand
                        && command.sessionId().equals(1L)
                        && command.slotCode().equals("order_id")
                        && command.value().asText().equals("A-100")));
  }

  @Test
  @DisplayName("updateSlot: 현재 요청되지 않은 slot은 거부한다")
  void should_rejectOutOfTurnSlot() {
    LlmToolContextResponse context = context(10L);
    givenRuntimeMetadata();
    given(llmToolService.getContext(any(GetLlmToolContextCommand.class)))
        .willReturn(context, context);
    given(workflowRuntimeService.advance(1L))
        .willReturn(advanceResponse("collect_order", "answer", "ANSWER", "edge-answer", List.of()));

    assertThatThrownBy(() -> service.updateSlot(1L, "order_id", "A-100"))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("No slot is currently requested");

    verify(llmToolService, never()).upsertSlotValue(any());
  }

  private void givenRuntimeMetadata() {
    ChatSession session = ChatSession.create(2L, 3L, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", 1L);
    WorkflowExecution execution = WorkflowExecution.create(1L);
    ReflectionTestUtils.setField(execution, "id", 10L);
    execution.assignIntentWorkflow(70L, 80L, "collect_order");
    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            3L,
            "refund_flow",
            "환불 워크플로우",
            null,
            """
            {
              "nodes": [
                {"id": "collect_order", "type": "ACTION", "label": "주문 확인"},
                {"id": "answer", "type": "ANSWER", "label": "답변"}
              ],
              "edges": []
            }
            """,
            "collect_order",
            "[]",
            "[]",
            "{}",
            70L,
            true,
            "{}");
    ReflectionTestUtils.setField(workflow, "id", 80L);

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.of(execution));
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(80L, 3L))
        .willReturn(Optional.of(workflow));
  }

  private LlmToolContextResponse context(Long executionId) {
    return new LlmToolContextResponse(
        1L,
        2L,
        3L,
        executionId,
        executionId == null ? null : "RUNNING",
        executionId == null ? null : "collect_order",
        objectMapper.createObjectNode(),
        objectMapper.createObjectNode(),
        null,
        List.of("order_id"),
        executionId == null ? List.of() : List.of(slot()));
  }

  private LlmToolSlotResponse slot() {
    return new LlmToolSlotResponse(
        11L,
        "order_id",
        "주문번호",
        "주문번호",
        "STRING",
        false,
        objectMapper.createObjectNode(),
        null,
        objectMapper.createObjectNode(),
        "ACTIVE",
        true,
        1,
        "주문번호를 입력하세요",
        false,
        NullNode.getInstance());
  }

  private WorkflowAdvanceResponse advanceResponse(
      String previousState,
      String currentState,
      String actionType,
      String edgeId,
      List<String> missingSlotCodes) {
    return new WorkflowAdvanceResponse(
        1L,
        10L,
        "RUNNING",
        previousState,
        currentState,
        actionType,
        actionType,
        edgeId,
        currentState,
        missingSlotCodes,
        NullNode.getInstance(),
        objectMapper.createObjectNode(),
        null,
        null,
        "test");
  }
}
