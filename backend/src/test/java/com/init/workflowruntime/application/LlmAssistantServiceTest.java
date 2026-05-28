package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
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

    String result =
        service
            .generateWorkflowAwareResponse(
                new GenerateWorkflowAwareResponseCommand(1L, "USER: 주문 조회", "A-100 봐줘"))
            .content();

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

    String result =
        service
            .generateWorkflowAwareResponse(
                new GenerateWorkflowAwareResponseCommand(1L, "", "환불하고 싶어요"))
            .content();

    assertThat(result).isEqualTo("환불 절차를 안내드릴게요.");
    verify(llmToolService)
        .selectIntent(
            argThat(
                command ->
                    command.sessionId().equals(1L)
                        && command.intentCode().equals("refund_request")));
    verify(workflowRuntimeService).advance(1L);
  }

  @Test
  @DisplayName("generateWorkflowAwareResponse: intent confidence 누락 시 선택하지 않고 재질문한다")
  void should_askClarification_when_intentConfidenceMissing() {
    LlmToolContextResponse contextWithoutWorkflow = context(null, null, List.of(), List.of());
    LlmToolIntentResponse refundIntent = intent("refund_request");

    given(llmToolService.getContext(any())).willReturn(contextWithoutWorkflow);
    given(llmToolService.listIntents(any())).willReturn(List.of(refundIntent));
    given(chatClient.prompt()).willReturn(promptSpec);
    given(promptSpec.user(any(Consumer.class))).willReturn(promptSpec);
    given(promptSpec.call()).willReturn(callSpec);
    given(callSpec.content())
        .willReturn("{\"intentCode\":\"refund_request\"}", "어떤 업무를 도와드리면 될까요?");

    String result =
        service
            .generateWorkflowAwareResponse(
                new GenerateWorkflowAwareResponseCommand(1L, "", "도와주세요"))
            .content();

    assertThat(result).isEqualTo("어떤 업무를 도와드리면 될까요?");
    verify(llmToolService, never()).selectIntent(any());
    verify(workflowRuntimeService, never()).advance(1L);
  }

  @Test
  @DisplayName("generateWorkflowAwareResponse: numeric confidence가 낮으면 intent를 선택하지 않는다")
  void should_askClarification_when_intentConfidenceLow() {
    LlmToolContextResponse contextWithoutWorkflow = context(null, null, List.of(), List.of());
    LlmToolIntentResponse refundIntent = intent("refund_request");

    given(llmToolService.getContext(any())).willReturn(contextWithoutWorkflow);
    given(llmToolService.listIntents(any())).willReturn(List.of(refundIntent));
    given(chatClient.prompt()).willReturn(promptSpec);
    given(promptSpec.user(any(Consumer.class))).willReturn(promptSpec);
    given(promptSpec.call()).willReturn(callSpec);
    given(callSpec.content())
        .willReturn(
            "```json\n{\"intentCode\":\"refund_request\",\"confidence\":0.3}\n```",
            "조금 더 자세히 말씀해 주세요.");

    String result =
        service
            .generateWorkflowAwareResponse(
                new GenerateWorkflowAwareResponseCommand(1L, "", "애매한 요청"))
            .content();

    assertThat(result).isEqualTo("조금 더 자세히 말씀해 주세요.");
    verify(llmToolService, never()).selectIntent(any());
  }

  @Test
  @DisplayName("generateWorkflowAwareResponse: slot 추출 JSON이 유효하지 않으면 upsert 없이 advance한다")
  void should_skipSlotUpsert_when_slotExtractionInvalid() {
    LlmToolContextResponse contextWithMissingSlot =
        context(10L, "START", List.of("order_id"), List.of(slot("order_id", false)));
    WorkflowAdvanceResponse askSlotResponse =
        advanceResponse("START", "START", "ASK_SLOT", null, List.of("order_id"));

    given(llmToolService.getContext(any()))
        .willReturn(contextWithMissingSlot, contextWithMissingSlot);
    given(workflowRuntimeService.advance(1L)).willReturn(askSlotResponse);
    given(chatClient.prompt()).willReturn(promptSpec);
    given(promptSpec.user(any(Consumer.class))).willReturn(promptSpec);
    given(promptSpec.call()).willReturn(callSpec);
    given(callSpec.content()).willReturn("not-json", "주문번호를 알려주세요.");

    String result =
        service
            .generateWorkflowAwareResponse(
                new GenerateWorkflowAwareResponseCommand(1L, "USER: 주문 조회", "몰라요"))
            .content();

    assertThat(result).isEqualTo("주문번호를 알려주세요.");
    verify(llmToolService, never()).upsertSlotValue(any());
    verify(workflowRuntimeService).advance(1L);
  }

  @Test
  @DisplayName("generateWorkflowAwareResponse: ADVANCE가 반복되면 중복 전이를 중단한다")
  void should_stopAdvanceLoop_when_transitionRepeats() {
    LlmToolContextResponse context = context(10L, "START", List.of(), List.of());
    WorkflowAdvanceResponse repeatedAdvance =
        advanceResponse("START", "MIDDLE", "ADVANCE", "edge-1", List.of());

    given(llmToolService.getContext(any())).willReturn(context, context);
    given(workflowRuntimeService.advance(1L)).willReturn(repeatedAdvance, repeatedAdvance);
    given(chatClient.prompt()).willReturn(promptSpec);
    given(promptSpec.user(any(Consumer.class))).willReturn(promptSpec);
    given(promptSpec.call()).willReturn(callSpec);
    given(callSpec.content()).willReturn("반복 전이가 감지되어 현재 상태를 안내합니다.");

    String result =
        service
            .generateWorkflowAwareResponse(
                new GenerateWorkflowAwareResponseCommand(1L, "USER: 진행", "계속"))
            .content();

    assertThat(result).isEqualTo("반복 전이가 감지되어 현재 상태를 안내합니다.");
    verify(workflowRuntimeService, org.mockito.Mockito.times(2)).advance(1L);
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

  private LlmToolIntentResponse intent(String intentCode) {
    return new LlmToolIntentResponse(
        3L,
        intentCode,
        "환불 요청",
        "환불 요청 intent",
        1,
        null,
        "ACTIVE",
        objectMapper.createObjectNode(),
        objectMapper.createObjectNode());
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
