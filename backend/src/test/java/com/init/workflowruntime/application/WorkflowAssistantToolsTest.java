package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.shared.application.exception.BadRequestException;
import com.init.workflowruntime.application.command.InspectAssistantConversationCommand;
import com.init.workflowruntime.application.command.IntentClassificationCommand;
import com.init.workflowruntime.application.command.StartAssistantWorkflowCommand;
import com.init.workflowruntime.application.command.UpdateAssistantSlotCommand;
import com.init.workflowruntime.application.dto.AssistantConversationResult;
import com.init.workflowruntime.application.dto.AssistantConversationState;
import com.init.workflowruntime.application.dto.AssistantNextAction;
import com.init.workflowruntime.application.dto.AssistantWorkflowView;
import com.init.workflowruntime.application.dto.IntentClassificationResult;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.model.ToolContext;

@ExtendWith(MockitoExtension.class)
@DisplayName("WorkflowAssistantTools")
class WorkflowAssistantToolsTest {

  @Mock private WorkflowAssistantStateService stateService;
  @Mock private IntentClassificationService intentClassificationService;

  private WorkflowAssistantTools tools;

  @BeforeEach
  void setUp() {
    tools = new WorkflowAssistantTools(stateService, intentClassificationService);
  }

  @Test
  @DisplayName("inspectConversation: ToolContext의 sessionId로 상태를 조회한다")
  void should_inspectWithSessionIdFromToolContext() {
    ToolContext toolContext = toolContext();
    given(stateService.inspect(new InspectAssistantConversationCommand(1L)))
        .willReturn(AssistantConversationResult.of(AssistantConversationState.needIntent()));

    AssistantConversationState result = tools.inspectConversation(toolContext);

    assertThat(result.nextAction().type()).isEqualTo("NEED_INTENT");
    verify(stateService).inspect(new InspectAssistantConversationCommand(1L));
  }

  @Test
  @DisplayName("classifyIntent: ToolContext의 최신 발화와 대화 맥락으로 분류한다")
  void should_classifyWithMessagesFromToolContext() {
    ToolContext toolContext = toolContext();
    IntentClassificationCommand command =
        new IntentClassificationCommand(1L, "환불하고 싶어요", "USER: 안녕하세요");
    given(intentClassificationService.classify(command))
        .willReturn(IntentClassificationResult.unknown("확인이 필요합니다."));

    IntentClassificationResult result = tools.classifyIntent(toolContext);

    assertThat(result.status()).isEqualTo("UNKNOWN");
    verify(intentClassificationService).classify(command);
  }

  @Test
  @DisplayName("classifyIntent: message/context가 없으면 빈 문자열로 분류한다")
  void should_classifyWithEmptyText_when_textContextMissing() {
    ToolContext toolContext = new ToolContext(Map.of("sessionId", 1L));
    IntentClassificationCommand command = new IntentClassificationCommand(1L, "", "");
    given(intentClassificationService.classify(command))
        .willReturn(IntentClassificationResult.unknown("확인이 필요합니다."));

    IntentClassificationResult result = tools.classifyIntent(toolContext);

    assertThat(result.status()).isEqualTo("UNKNOWN");
    verify(intentClassificationService).classify(command);
  }

  @Test
  @DisplayName("classifyIntent 실패: 내부 예외 메시지 대신 UNKNOWN을 반환한다")
  void should_returnUnknownIntent_when_classifyFails() {
    ToolContext toolContext = toolContext();
    IntentClassificationCommand command =
        new IntentClassificationCommand(1L, "환불하고 싶어요", "USER: 안녕하세요");
    given(intentClassificationService.classify(command))
        .willThrow(new IllegalArgumentException("raw intent list leaked"));

    IntentClassificationResult result = tools.classifyIntent(toolContext);

    assertThat(result.status()).isEqualTo("UNKNOWN");
    assertThat(result.message()).doesNotContain("raw intent list");
  }

  @Test
  @DisplayName("startWorkflow: 문자열 sessionId를 Long으로 변환해 workflow를 시작한다")
  void should_startWorkflowWithStringSessionId() {
    ToolContext toolContext =
        new ToolContext(
            Map.of(
                "sessionId", "1",
                "latestUserMessage", "환불하고 싶어요",
                "conversationContext", "USER: 안녕하세요"));
    AssistantConversationState expected =
        new AssistantConversationState(
            "COMPLETED",
            new AssistantWorkflowView("COMPLETED", "완료"),
            new AssistantNextAction("COMPLETED", null, null, "완료되었습니다.", "완료 안내"),
            List.of());
    given(stateService.startWorkflow(new StartAssistantWorkflowCommand(1L, "refund_request")))
        .willReturn(AssistantConversationResult.of(expected));

    AssistantConversationState result = tools.startWorkflow("refund_request", toolContext);

    assertThat(result).isSameAs(expected);
    verify(stateService).startWorkflow(new StartAssistantWorkflowCommand(1L, "refund_request"));
  }

  @Test
  @DisplayName("startWorkflow 실패: 내부 예외 메시지 대신 redacted ERROR 상태를 반환한다")
  void should_returnRedactedErrorState_when_startWorkflowFails() {
    ToolContext toolContext = toolContext();
    given(stateService.startWorkflow(new StartAssistantWorkflowCommand(1L, "refund_request")))
        .willThrow(new BadRequestException("WORKFLOW_INVALID", "workflow graph leaked"));

    AssistantConversationState result = tools.startWorkflow("refund_request", toolContext);

    assertThat(result.nextAction().type()).isEqualTo("ERROR");
    assertThat(result.nextAction().message()).doesNotContain("workflow graph");
  }

  @Test
  @DisplayName("updateSlot: 현재 요청 slot 값을 state service에 위임한다")
  void should_updateSlotWithRequestedValue() {
    ToolContext toolContext = toolContext();
    AssistantConversationState expected =
        new AssistantConversationState(
            "IN_WORKFLOW",
            new AssistantWorkflowView("RUNNING", "답변"),
            new AssistantNextAction("ANSWER", null, null, null, "답변 안내"),
            List.of());
    given(stateService.updateSlot(new UpdateAssistantSlotCommand(1L, "order_id", "A-100")))
        .willReturn(AssistantConversationResult.of(expected));

    AssistantConversationState result = tools.updateSlot("order_id", "A-100", toolContext);

    assertThat(result).isSameAs(expected);
    verify(stateService).updateSlot(new UpdateAssistantSlotCommand(1L, "order_id", "A-100"));
  }

  @Test
  @DisplayName("updateSlot 실패: 내부 예외 메시지 대신 redacted ERROR 상태를 반환한다")
  void should_returnRedactedErrorState_when_updateSlotFails() {
    ToolContext toolContext = toolContext();
    given(stateService.updateSlot(new UpdateAssistantSlotCommand(1L, "order_id", "A-100")))
        .willThrow(new BadRequestException("SLOT_INVALID", "slotValues leaked"));

    AssistantConversationState result = tools.updateSlot("order_id", "A-100", toolContext);

    assertThat(result.nextAction().type()).isEqualTo("ERROR");
    assertThat(result.nextAction().message()).doesNotContain("slotValues");
  }

  @Test
  @DisplayName("tool 실패: 내부 예외 메시지 대신 redacted ERROR 상태를 반환한다")
  void should_returnRedactedErrorState_when_toolFails() {
    ToolContext toolContext = toolContext();
    given(stateService.inspect(new InspectAssistantConversationCommand(1L)))
        .willThrow(new BadRequestException("STATE_INVALID", "policySnapshot leaked"));

    AssistantConversationState result = tools.inspectConversation(toolContext);

    assertThat(result.nextAction().type()).isEqualTo("ERROR");
    assertThat(result.nextAction().message()).doesNotContain("policySnapshot");
  }

  @Test
  @DisplayName("예상하지 못한 런타임 예외는 도구 응답으로 삼키지 않는다")
  void should_propagateUnexpectedRuntimeException() {
    ToolContext toolContext = toolContext();
    given(stateService.inspect(new InspectAssistantConversationCommand(1L)))
        .willThrow(new IllegalStateException("programming error"));

    assertThatThrownBy(() -> tools.inspectConversation(toolContext))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("programming error");
  }

  @Test
  @DisplayName("tool context가 없으면 redacted ERROR 상태를 반환한다")
  void should_returnRedactedErrorState_when_toolContextMissing() {
    AssistantConversationState result = tools.inspectConversation(null);

    assertThat(result.nextAction().type()).isEqualTo("ERROR");
    assertThat(result.nextAction().message()).doesNotContain("sessionId");
  }

  private ToolContext toolContext() {
    return new ToolContext(
        Map.of(
            "sessionId", 1L,
            "latestUserMessage", "환불하고 싶어요",
            "conversationContext", "USER: 안녕하세요"));
  }
}
