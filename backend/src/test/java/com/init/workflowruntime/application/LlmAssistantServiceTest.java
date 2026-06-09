package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
import com.init.workflowruntime.application.command.InspectAssistantConversationCommand;
import com.init.workflowruntime.application.dto.AssistantConversationResult;
import com.init.workflowruntime.application.dto.AssistantConversationState;
import com.init.workflowruntime.application.dto.AssistantNextAction;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ChatClient.CallResponseSpec;
import org.springframework.ai.chat.client.ChatClient.ChatClientRequestSpec;
import org.springframework.ai.retry.NonTransientAiException;

@ExtendWith(MockitoExtension.class)
@DisplayName("LlmAssistantService")
@SuppressWarnings({"unchecked", "rawtypes"})
class LlmAssistantServiceTest {

  private static final String COUNSELOR_DRAFT_RESPONSE = "주문번호를 확인해주시면 환불 상태를 안내드리겠습니다.";

  @Mock private ChatClient chatClient;
  @Mock private ChatClientRequestSpec promptSpec;
  @Mock private CallResponseSpec callSpec;
  @Mock private WorkflowAssistantTools workflowAssistantTools;
  @Mock private WorkflowAssistantStateService workflowAssistantStateService;

  private LlmAssistantService service;

  @BeforeEach
  void setUp() {
    service =
        new LlmAssistantService(
            chatClient, workflowAssistantTools, workflowAssistantStateService, false);
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
  @DisplayName("generateWorkflowAwareResponse: Spring AI tool과 ToolContext를 연결한다")
  void should_callChatClientWithWorkflowToolsAndToolContext() {
    given(chatClient.prompt()).willReturn(promptSpec);
    given(promptSpec.tools(workflowAssistantTools)).willReturn(promptSpec);
    given(promptSpec.toolContext(anyMap())).willReturn(promptSpec);
    given(promptSpec.user(any(Consumer.class))).willReturn(promptSpec);
    given(promptSpec.call()).willReturn(callSpec);
    given(callSpec.content()).willReturn("주문번호를 알려주시겠어요?");

    String result =
        service
            .generateWorkflowAwareResponse(
                new GenerateWorkflowAwareResponseCommand(1L, "USER: 환불하고 싶어요", "주문 취소했어요"))
            .content();

    assertThat(result).isEqualTo("주문번호를 알려주시겠어요?");
    verify(promptSpec).tools(workflowAssistantTools);

    ArgumentCaptor<Map<String, Object>> contextCaptor = ArgumentCaptor.forClass(Map.class);
    verify(promptSpec).toolContext(contextCaptor.capture());
    assertThat(contextCaptor.getValue())
        .containsEntry("sessionId", 1L)
        .containsEntry("conversationContext", "USER: 환불하고 싶어요")
        .containsEntry("latestUserMessage", "주문 취소했어요");
  }

  @Test
  @DisplayName("generateWorkflowAwareResponse: null 메시지는 빈 문자열로 ToolContext에 넣는다")
  void should_putEmptyTextInToolContext_when_messagesAreNull() {
    given(chatClient.prompt()).willReturn(promptSpec);
    given(promptSpec.tools(workflowAssistantTools)).willReturn(promptSpec);
    given(promptSpec.toolContext(anyMap())).willReturn(promptSpec);
    given(promptSpec.user(any(Consumer.class))).willReturn(promptSpec);
    given(promptSpec.call()).willReturn(callSpec);
    given(callSpec.content()).willReturn("문의 내용을 알려주시겠어요?");

    String result =
        service
            .generateWorkflowAwareResponse(new GenerateWorkflowAwareResponseCommand(7L, null, null))
            .content();

    assertThat(result).isEqualTo("문의 내용을 알려주시겠어요?");

    ArgumentCaptor<Map<String, Object>> contextCaptor = ArgumentCaptor.forClass(Map.class);
    verify(promptSpec).toolContext(contextCaptor.capture());
    assertThat(contextCaptor.getValue())
        .containsEntry("sessionId", 7L)
        .containsEntry("conversationContext", "")
        .containsEntry("latestUserMessage", "");
  }

  @Test
  @DisplayName("generateCounselorDraftResponse: 도구 호출 없이 상담사 검토용 초안을 생성한다")
  void should_generateCounselorDraftWithoutTools() {
    given(chatClient.prompt()).willReturn(promptSpec);
    given(promptSpec.user(any(Consumer.class))).willReturn(promptSpec);
    given(promptSpec.call()).willReturn(callSpec);
    given(callSpec.content()).willReturn(COUNSELOR_DRAFT_RESPONSE);

    String result =
        service
            .generateCounselorDraftResponse(
                "환불 워크플로우 (REFUND_FLOW)", "COLLECT_INFO", "CUSTOMER: 환불 문의드립니다.", "환불 문의드립니다.")
            .content();

    assertThat(result).isEqualTo(COUNSELOR_DRAFT_RESPONSE);
    verify(promptSpec, org.mockito.Mockito.never()).tools(workflowAssistantTools);
    verify(promptSpec, org.mockito.Mockito.never()).toolContext(anyMap());
  }

  @Test
  @DisplayName("generateWorkflowAwareResponse: fallback 활성화 시 LLM 실패를 backend nextAction 질문으로 대체한다")
  void should_returnFallbackPrompt_when_llmFailsAndFallbackEnabled() {
    service =
        new LlmAssistantService(
            chatClient, workflowAssistantTools, workflowAssistantStateService, true);
    given(chatClient.prompt()).willReturn(promptSpec);
    given(promptSpec.tools(workflowAssistantTools)).willReturn(promptSpec);
    given(promptSpec.toolContext(anyMap())).willReturn(promptSpec);
    given(promptSpec.user(any(Consumer.class))).willReturn(promptSpec);
    given(promptSpec.call()).willThrow(new NonTransientAiException("llm unavailable"));
    given(workflowAssistantStateService.inspect(new InspectAssistantConversationCommand(7L)))
        .willReturn(
            AssistantConversationResult.of(
                new AssistantConversationState(
                    "IN_WORKFLOW",
                    null,
                    new AssistantNextAction("ASK_SLOT", "orderNo", "주문번호를 알려주세요.", null, null),
                    java.util.List.of())));

    String result =
        service
            .generateWorkflowAwareResponse(new GenerateWorkflowAwareResponseCommand(7L, null, null))
            .content();

    assertThat(result).isEqualTo("주문번호를 알려주세요.");
  }

  @Test
  @DisplayName("generateWorkflowAwareResponse: fallback 비활성화 시 LLM 실패를 다시 던진다")
  void should_rethrowAiFailure_when_fallbackDisabled() {
    givenWorkflowChatThrows(new NonTransientAiException("llm unavailable"));

    assertThatThrownBy(
            () ->
                service.generateWorkflowAwareResponse(
                    new GenerateWorkflowAwareResponseCommand(7L, null, null)))
        .isInstanceOf(NonTransientAiException.class)
        .hasMessageContaining("llm unavailable");
  }

  @Test
  @DisplayName("generateWorkflowAwareResponse: 질문이 비어 있으면 fallback message를 사용한다")
  void should_returnFallbackMessage_when_questionIsBlank() {
    service =
        new LlmAssistantService(
            chatClient, workflowAssistantTools, workflowAssistantStateService, true);
    givenWorkflowChatThrows(new NonTransientAiException("llm unavailable"));
    given(workflowAssistantStateService.inspect(new InspectAssistantConversationCommand(8L)))
        .willReturn(
            AssistantConversationResult.of(
                new AssistantConversationState(
                    "IN_WORKFLOW",
                    null,
                    new AssistantNextAction("ANSWER", null, " ", "확인 결과를 안내드리겠습니다.", null),
                    java.util.List.of())));

    String result =
        service
            .generateWorkflowAwareResponse(new GenerateWorkflowAwareResponseCommand(8L, null, null))
            .content();

    assertThat(result).isEqualTo("확인 결과를 안내드리겠습니다.");
  }

  @Test
  @DisplayName("generateWorkflowAwareResponse: workflow state가 없으면 기본 fallback 문구를 사용한다")
  void should_returnDefaultFallback_when_stateIsMissing() {
    service =
        new LlmAssistantService(
            chatClient, workflowAssistantTools, workflowAssistantStateService, true);
    givenWorkflowChatThrows(new NonTransientAiException("llm unavailable"));
    given(workflowAssistantStateService.inspect(new InspectAssistantConversationCommand(9L)))
        .willReturn(AssistantConversationResult.of(null));

    String result =
        service
            .generateWorkflowAwareResponse(new GenerateWorkflowAwareResponseCommand(9L, null, null))
            .content();

    assertThat(result).isEqualTo("문의 내용을 확인하기 위해 필요한 정보를 조금 더 알려주세요.");
  }

  @Test
  @DisplayName("generateWorkflowAwareResponse: fallback 활성화 시에도 내부 버그는 숨기지 않는다")
  void should_notCatchInternalRuntimeException_when_fallbackEnabled() {
    service =
        new LlmAssistantService(
            chatClient, workflowAssistantTools, workflowAssistantStateService, true);
    givenWorkflowChatThrows(new IllegalStateException("invalid prompt state"));

    assertThatThrownBy(
            () ->
                service.generateWorkflowAwareResponse(
                    new GenerateWorkflowAwareResponseCommand(10L, null, null)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("invalid prompt state");
  }

  private void givenWorkflowChatThrows(RuntimeException exception) {
    given(chatClient.prompt()).willReturn(promptSpec);
    given(promptSpec.tools(workflowAssistantTools)).willReturn(promptSpec);
    given(promptSpec.toolContext(anyMap())).willReturn(promptSpec);
    given(promptSpec.user(any(Consumer.class))).willReturn(promptSpec);
    given(promptSpec.call()).willThrow(exception);
  }
}
