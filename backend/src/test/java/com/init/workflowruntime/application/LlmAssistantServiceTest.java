package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolIntentResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotResponse;
import com.init.workflowruntime.application.dto.WorkflowAdvanceResponse;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ChatClient.CallResponseSpec;
import org.springframework.ai.chat.client.ChatClient.ChatClientRequestSpec;

@ExtendWith(MockitoExtension.class)
@DisplayName("LlmAssistantService")
class LlmAssistantServiceTest {

  @Mock private ChatClient chatClient;
  @Mock private ChatClientRequestSpec promptSpec;
  @Mock private CallResponseSpec callSpec;
  @Mock private LlmToolService llmToolService;
  @Mock private WorkflowRuntimeService workflowRuntimeService;

  private ObjectMapper objectMapper;
  private LlmAssistantService service;

  @BeforeEach
  void setUp() {
    objectMapper = new ObjectMapper();
    service =
        new LlmAssistantService(chatClient, llmToolService, workflowRuntimeService, objectMapper);
  }

  @Test
  @DisplayName("generateResponse: 유저 메시지 → LLM 응답 반환")
  void should_returnLlmResponse_when_userMessageProvided() {
    given(chatClient.prompt()).willReturn(promptSpec);
    given(promptSpec.user(any(Consumer.class))).willReturn(promptSpec);
    given(promptSpec.call()).willReturn(callSpec);
    given(callSpec.content()).willReturn("안녕하세요! 무엇을 도와드릴까요?");

    String result = service.generateResponse("기존 대화 컨텍스트", "안녕하세요");

    assertThat(result).isEqualTo("안녕하세요! 무엇을 도와드릴까요?");
  }

  @Test
  @DisplayName("generateWorkflowAwareResponse: 누락 slot 추출 후 workflow advance 결과로 응답한다")
  void should_collectMissingSlotAndAdvance_when_workflowSelected() {
    LlmToolContextResponse contextWithMissingSlot =
        context(10L, "START", List.of("order_id"), List.of(slot("order_id", false)));
    LlmToolContextResponse contextWithSlot =
        context(10L, "START", List.of(), List.of(slot("order_id", true)));
    WorkflowAdvanceResponse advanceResponse =
        advanceResponse("START", "ORDER_FOUND", "ANSWER", "edge-1", List.of());

    given(llmToolService.getContext(any())).willReturn(contextWithMissingSlot, contextWithSlot);
    given(workflowRuntimeService.advance(1L)).willReturn(advanceResponse);
    given(chatClient.prompt()).willReturn(promptSpec);
    given(promptSpec.user(any(Consumer.class))).willReturn(promptSpec);
    given(promptSpec.call()).willReturn(callSpec);
    given(callSpec.content())
        .willReturn(
            "{\"values\":[{\"slotCode\":\"order_id\",\"value\":\"A-100\"}]}", "주문 A-100을 확인했습니다.");

    String result = service.generateWorkflowAwareResponse(1L, "USER: 주문 조회", "A-100 봐줘");

    assertThat(result).isEqualTo("주문 A-100을 확인했습니다.");
    verify(llmToolService)
        .upsertSlotValue(
            argThat(
                command ->
                    command.sessionId().equals(1L)
                        && command.slotCode().equals("order_id")
                        && command.value().asText().equals("A-100")));
    verify(workflowRuntimeService).advance(1L);
  }

  @Test
  @DisplayName("generateWorkflowAwareResponse: workflow 미선택 세션은 intent 선택 후 advance한다")
  void should_selectIntentAndAdvance_when_workflowNotSelected() {
    LlmToolContextResponse contextWithoutWorkflow = context(null, null, List.of(), List.of());
    LlmToolContextResponse contextWithWorkflow = context(20L, "START", List.of(), List.of());
    WorkflowAdvanceResponse advanceResponse =
        advanceResponse("START", "REFUND_GUIDE", "ANSWER", "edge-refund", List.of());
    LlmToolIntentResponse refundIntent =
        new LlmToolIntentResponse(
            3L,
            "refund_request",
            "환불 요청",
            "환불 요청 intent",
            1,
            null,
            "ACTIVE",
            objectMapper.createObjectNode(),
            objectMapper.createObjectNode());

    given(llmToolService.getContext(any()))
        .willReturn(contextWithoutWorkflow, contextWithWorkflow, contextWithWorkflow);
    given(llmToolService.listIntents(any())).willReturn(List.of(refundIntent));
    given(workflowRuntimeService.advance(1L)).willReturn(advanceResponse);
    given(chatClient.prompt()).willReturn(promptSpec);
    given(promptSpec.user(any(Consumer.class))).willReturn(promptSpec);
    given(promptSpec.call()).willReturn(callSpec);
    given(callSpec.content())
        .willReturn(
            "{\"intentCode\":\"refund_request\",\"confidence\":0.91,\"reason\":\"환불 요청\"}",
            "환불 절차를 안내드릴게요.");

    String result = service.generateWorkflowAwareResponse(1L, "", "환불하고 싶어요");

    assertThat(result).isEqualTo("환불 절차를 안내드릴게요.");
    verify(llmToolService)
        .selectIntent(
            argThat(
                command ->
                    command.sessionId().equals(1L)
                        && command.intentCode().equals("refund_request")));
    verify(workflowRuntimeService).advance(1L);
  }

  private LlmToolContextResponse context(
      Long executionId,
      String currentState,
      List<String> missingSlots,
      List<LlmToolSlotResponse> slots) {
    return new LlmToolContextResponse(
        1L,
        2L,
        3L,
        executionId,
        executionId == null ? null : "RUNNING",
        currentState,
        objectMapper.createObjectNode(),
        objectMapper.createObjectNode(),
        null,
        missingSlots,
        slots);
  }

  private LlmToolSlotResponse slot(String slotCode, boolean hasValue) {
    return new LlmToolSlotResponse(
        10L,
        slotCode,
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
        hasValue,
        hasValue ? objectMapper.getNodeFactory().textNode("A-100") : NullNode.getInstance());
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
        "ANSWER",
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
