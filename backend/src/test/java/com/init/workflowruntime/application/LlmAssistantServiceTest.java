package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
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

@ExtendWith(MockitoExtension.class)
@DisplayName("LlmAssistantService")
@SuppressWarnings({"unchecked", "rawtypes"})
class LlmAssistantServiceTest {

  private static final String COUNSELOR_DRAFT_RESPONSE = "주문번호를 확인해주시면 환불 상태를 안내드리겠습니다.";

  @Mock private ChatClient chatClient;
  @Mock private ChatClientRequestSpec promptSpec;
  @Mock private CallResponseSpec callSpec;
  @Mock private WorkflowAssistantTools workflowAssistantTools;

  private LlmAssistantService service;

  @BeforeEach
  void setUp() {
    service = new LlmAssistantService(chatClient, workflowAssistantTools);
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
}
