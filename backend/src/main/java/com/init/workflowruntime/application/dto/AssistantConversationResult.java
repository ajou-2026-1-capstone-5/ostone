package com.init.workflowruntime.application.dto;

public record AssistantConversationResult(AssistantConversationState state) {

  public static AssistantConversationResult of(AssistantConversationState state) {
    return new AssistantConversationResult(state);
  }
}
