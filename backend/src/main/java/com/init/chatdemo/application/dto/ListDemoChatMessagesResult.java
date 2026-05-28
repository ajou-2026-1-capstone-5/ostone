package com.init.chatdemo.application.dto;

import com.init.workflowruntime.application.dto.ChatMessageResponse;
import java.util.List;

public class ListDemoChatMessagesResult {

  private final List<ChatMessageResponse> messages;

  public ListDemoChatMessagesResult(List<ChatMessageResponse> messages) {
    this.messages = List.copyOf(messages);
  }

  public List<ChatMessageResponse> getMessages() {
    return messages;
  }
}
