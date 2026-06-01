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
  private static final String WORKFLOW_AWARE_USER_PROMPT =
      """
      Recent conversation:
      {context}

      Latest user message:
      {message}
      """;
  private static final String COUNSELOR_DRAFT_PROMPT =
      """
      You are drafting a Korean customer-service reply for a human counselor.
      The counselor will review and edit the text before sending it.
      Do not mention that the text was generated.
      Return only the draft message body.

      Matched workflow:
      {workflow}

      Current workflow state:
      {state}

      Recent conversation:
      {context}

      Latest customer message:
      {message}
      """;

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
                    u.text(WORKFLOW_AWARE_USER_PROMPT)
                        .param("context", nullToEmpty(command.conversationContext()))
                        .param("message", nullToEmpty(command.userMessage())))
            .call()
            .content();
    return new GenerateWorkflowAwareResponseResult(content);
  }

  public GenerateWorkflowAwareResponseResult generateCounselorDraftResponse(
      String workflowSummary, String currentState, String conversationContext, String userMessage) {
    String content =
        chatClient
            .prompt()
            .user(
                u ->
                    u.text(COUNSELOR_DRAFT_PROMPT)
                        .param("workflow", nullToEmpty(workflowSummary))
                        .param("state", nullToEmpty(currentState))
                        .param("context", nullToEmpty(conversationContext))
                        .param("message", nullToEmpty(userMessage)))
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
