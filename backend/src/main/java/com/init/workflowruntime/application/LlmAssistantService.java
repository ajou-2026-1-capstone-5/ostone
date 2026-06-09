package com.init.workflowruntime.application;

import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
import com.init.workflowruntime.application.command.InspectAssistantConversationCommand;
import com.init.workflowruntime.application.dto.AssistantConversationState;
import com.init.workflowruntime.application.dto.AssistantNextAction;
import com.init.workflowruntime.application.dto.GenerateWorkflowAwareResponseResult;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.retry.NonTransientAiException;
import org.springframework.ai.retry.TransientAiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class LlmAssistantService {

  private static final Logger log = LoggerFactory.getLogger(LlmAssistantService.class);

  private static final String SESSION_ID = "sessionId";
  private static final String LATEST_USER_MESSAGE = "latestUserMessage";
  private static final String CONVERSATION_CONTEXT = "conversationContext";
  private static final String DEFAULT_FALLBACK_RESPONSE = "문의 내용을 확인하기 위해 필요한 정보를 조금 더 알려주세요.";
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
  private final WorkflowAssistantStateService workflowAssistantStateService;
  private final boolean fallbackEnabled;

  public LlmAssistantService(
      ChatClient chatClient,
      WorkflowAssistantTools workflowAssistantTools,
      WorkflowAssistantStateService workflowAssistantStateService,
      @Value("${app.ai.chat.fallback.enabled:false}") boolean fallbackEnabled) {
    this.chatClient = chatClient;
    this.workflowAssistantTools = workflowAssistantTools;
    this.workflowAssistantStateService = workflowAssistantStateService;
    this.fallbackEnabled = fallbackEnabled;
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
    try {
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
    } catch (NonTransientAiException | TransientAiException e) {
      if (!fallbackEnabled) {
        throw e;
      }
      log.warn("LLM workflow response failed; using deterministic fallback: {}", e.toString());
      log.debug("LLM workflow response failure detail", e);
      return new GenerateWorkflowAwareResponseResult(fallbackWorkflowResponse(command.sessionId()));
    }
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

  private String fallbackWorkflowResponse(Long sessionId) {
    AssistantConversationState state =
        workflowAssistantStateService
            .inspect(new InspectAssistantConversationCommand(sessionId))
            .state();
    if (state == null) {
      return DEFAULT_FALLBACK_RESPONSE;
    }
    AssistantNextAction nextAction = state.nextAction();
    if (nextAction == null) {
      return DEFAULT_FALLBACK_RESPONSE;
    }
    String prompt = nullToEmpty(nextAction.question()).trim();
    if (prompt.isEmpty()) {
      prompt = nullToEmpty(nextAction.message()).trim();
    }
    if (!prompt.isEmpty()) {
      return prompt;
    }
    return switch (nullToEmpty(nextAction.type())) {
      case "ANSWER" -> "확인한 업무 기준에 따라 안내드리겠습니다.";
      case "COMPLETED" -> "요청 처리가 완료되었습니다.";
      case "HANDOFF" -> "이 요청은 상담원 추가 확인이 필요합니다.";
      case "NEED_INTENT" -> "어떤 업무를 도와드리면 될지 조금 더 자세히 알려주세요.";
      default -> DEFAULT_FALLBACK_RESPONSE;
    };
  }

  private String nullToEmpty(String value) {
    return value == null ? "" : value;
  }
}
