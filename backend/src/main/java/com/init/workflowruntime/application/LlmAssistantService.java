package com.init.workflowruntime.application;

import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
import com.init.workflowruntime.application.dto.GenerateWorkflowAwareResponseResult;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
public class LlmAssistantService {

  private static final String SESSION_ID = "sessionId";
  private static final String LATEST_USER_MESSAGE = "latestUserMessage";
  private static final String CONVERSATION_CONTEXT = "conversationContext";

  private final ChatClient chatClient;
  private final WorkflowAssistantTools workflowAssistantTools;

  public LlmAssistantService(ChatClient chatClient, WorkflowAssistantTools workflowAssistantTools) {
    this.chatClient = chatClient;
    this.workflowAssistantTools = workflowAssistantTools;
  }

  public String generateResponse(String conversationContext, String userMessage) {
    return chatClient
        .prompt()
        .user(
            u ->
                u.text("Context: {context}\nUser: {message}")
                    .param("context", nullToEmpty(conversationContext))
                    .param("message", nullToEmpty(userMessage)))
        .call()
        .content();
  }

  public GenerateWorkflowAwareResponseResult generateWorkflowAwareResponse(
      GenerateWorkflowAwareResponseCommand command) {
    String content =
        chatClient
            .prompt()
            .tools(workflowAssistantTools)
            .toolContext(toolContext(command))
            .user(
                u ->
                    u.text(
                            """
                            Recent conversation:
                            {context}

                            Latest user message:
                            {message}
                            """)
                        .param("context", nullToEmpty(command.conversationContext()))
                        .param("message", nullToEmpty(command.userMessage())))
            .call()
            .content();
    return new GenerateWorkflowAwareResponseResult(content);
  }

  private Map<String, Object> toolContext(GenerateWorkflowAwareResponseCommand command) {
    Map<String, Object> context = new LinkedHashMap<>();
    context.put(SESSION_ID, command.sessionId());
    context.put(LATEST_USER_MESSAGE, nullToEmpty(command.userMessage()));
    context.put(CONVERSATION_CONTEXT, nullToEmpty(command.conversationContext()));
    return context;
  }

  private String nullToEmpty(String value) {
    return value == null ? "" : value;
  }
}
