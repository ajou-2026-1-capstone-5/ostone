package com.init.workflowruntime.application;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
public class LlmAssistantService {

  private final ChatClient chatClient;

  public LlmAssistantService(ChatClient chatClient) {
    this.chatClient = chatClient;
  }

  public String generateResponse(String conversationContext, String userMessage) {
    return chatClient
        .prompt()
        .user(
            u ->
                u.text("Context: {context}\nUser: {message}")
                    .param("context", conversationContext)
                    .param("message", userMessage))
        .call()
        .content();
  }
}
