package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.workflowruntime.application.dto.AssistantConversationState;
import com.init.workflowruntime.application.dto.IntentClassificationResult;
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
    given(stateService.inspect(1L)).willReturn(AssistantConversationState.needIntent());

    AssistantConversationState result = tools.inspectConversation(toolContext);

    assertThat(result.nextAction().type()).isEqualTo("NEED_INTENT");
    verify(stateService).inspect(1L);
  }

  @Test
  @DisplayName("classifyIntent: ToolContext의 최신 발화와 대화 맥락으로 분류한다")
  void should_classifyWithMessagesFromToolContext() {
    ToolContext toolContext = toolContext();
    given(intentClassificationService.classify(1L, "환불하고 싶어요", "USER: 안녕하세요"))
        .willReturn(IntentClassificationResult.unknown("확인이 필요합니다."));

    IntentClassificationResult result = tools.classifyIntent(toolContext);

    assertThat(result.status()).isEqualTo("UNKNOWN");
    verify(intentClassificationService).classify(1L, "환불하고 싶어요", "USER: 안녕하세요");
  }

  @Test
  @DisplayName("tool 실패: 내부 예외 메시지 대신 redacted ERROR 상태를 반환한다")
  void should_returnRedactedErrorState_when_toolFails() {
    ToolContext toolContext = toolContext();
    given(stateService.inspect(1L)).willThrow(new IllegalStateException("policySnapshot leaked"));

    AssistantConversationState result = tools.inspectConversation(toolContext);

    assertThat(result.nextAction().type()).isEqualTo("ERROR");
    assertThat(result.nextAction().message()).doesNotContain("policySnapshot");
  }

  private ToolContext toolContext() {
    return new ToolContext(
        Map.of(
            "sessionId", 1L,
            "latestUserMessage", "환불하고 싶어요",
            "conversationContext", "USER: 안녕하세요"));
  }
}
