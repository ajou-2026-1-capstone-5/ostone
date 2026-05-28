package com.init.workflowruntime.application.dto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class AssistantConversationStateTest {

  @Test
  void should_defensivelyCopyAllowedTools() {
    List<String> allowedTools = new ArrayList<>();
    allowedTools.add("update_slot");

    AssistantConversationState state =
        new AssistantConversationState("IN_WORKFLOW", null, null, allowedTools);
    allowedTools.add("inspect_conversation");

    assertThat(state.allowedTools()).containsExactly("update_slot");
    assertThatThrownBy(() -> state.allowedTools().add("classify_intent"))
        .isInstanceOf(UnsupportedOperationException.class);
  }

  @Test
  void should_useEmptyAllowedTools_when_allowedToolsIsNull() {
    AssistantConversationState state = new AssistantConversationState("ERROR", null, null, null);

    assertThat(state.allowedTools()).isEmpty();
  }
}
