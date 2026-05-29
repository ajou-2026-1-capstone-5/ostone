package com.init.workflowruntime.application.dto;

import java.util.List;

public record AssistantConversationState(
    String conversationStatus,
    AssistantWorkflowView workflow,
    AssistantNextAction nextAction,
    List<String> allowedTools) {

  public AssistantConversationState {
    allowedTools = allowedTools == null ? List.of() : List.copyOf(allowedTools);
  }

  public static AssistantConversationState needIntent() {
    return new AssistantConversationState(
        "NEED_INTENT",
        null,
        new AssistantNextAction(
            "NEED_INTENT", null, null, "요청하신 업무를 확인하겠습니다.", "classify_intent를 호출해 고객 의도를 확인하세요."),
        List.of("classify_intent"));
  }

  public static AssistantConversationState error(String message) {
    return new AssistantConversationState(
        "ERROR",
        null,
        new AssistantNextAction("ERROR", null, null, message, "고객에게 일시적인 오류를 간단히 안내하세요."),
        List.of());
  }
}
