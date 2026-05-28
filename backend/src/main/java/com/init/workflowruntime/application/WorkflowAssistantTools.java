package com.init.workflowruntime.application;

import com.init.workflowruntime.application.dto.AssistantConversationState;
import com.init.workflowruntime.application.dto.IntentClassificationResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

@Component
public class WorkflowAssistantTools {

  private static final Logger log = LoggerFactory.getLogger(WorkflowAssistantTools.class);
  private static final String SESSION_ID = "sessionId";
  private static final String LATEST_USER_MESSAGE = "latestUserMessage";
  private static final String CONVERSATION_CONTEXT = "conversationContext";

  private final WorkflowAssistantStateService stateService;
  private final IntentClassificationService intentClassificationService;

  public WorkflowAssistantTools(
      WorkflowAssistantStateService stateService,
      IntentClassificationService intentClassificationService) {
    this.stateService = stateService;
    this.intentClassificationService = intentClassificationService;
  }

  @Tool(
      name = "inspect_conversation",
      description =
          "Inspect the current conversation and return the next allowed assistant action.")
  public AssistantConversationState inspectConversation(ToolContext toolContext) {
    try {
      return stateService.inspect(sessionId(toolContext));
    } catch (RuntimeException e) {
      log.warn("Workflow assistant inspect_conversation failed: {}", e.getMessage());
      return AssistantConversationState.error("일시적으로 대화 상태를 확인할 수 없습니다.");
    }
  }

  @Tool(
      name = "classify_intent",
      description =
          "Classify the latest user message into an intent candidate without exposing the full intent list.")
  public IntentClassificationResult classifyIntent(ToolContext toolContext) {
    try {
      return intentClassificationService.classify(
          sessionId(toolContext),
          textContext(toolContext, LATEST_USER_MESSAGE),
          textContext(toolContext, CONVERSATION_CONTEXT));
    } catch (RuntimeException e) {
      log.warn("Workflow assistant classify_intent failed: {}", e.getMessage());
      return IntentClassificationResult.unknown("요청하신 업무를 정확히 확인하지 못했습니다. 어떤 업무인지 조금 더 자세히 알려주세요.");
    }
  }

  @Tool(
      name = "start_workflow",
      description =
          "Start a workflow for a confirmed intent code selected by the backend classifier.")
  public AssistantConversationState startWorkflow(
      @ToolParam(required = true, description = "Confirmed intent code returned by classify_intent")
          String intentCode,
      ToolContext toolContext) {
    try {
      return stateService.startWorkflow(sessionId(toolContext), intentCode);
    } catch (RuntimeException e) {
      log.warn("Workflow assistant start_workflow failed: {}", e.getMessage());
      return AssistantConversationState.error("요청하신 업무를 시작할 수 없습니다. 다시 한 번 문의 내용을 알려주세요.");
    }
  }

  @Tool(
      name = "update_slot",
      description = "Update only the slot currently requested by the backend next action.")
  public AssistantConversationState updateSlot(
      @ToolParam(
              required = true,
              description = "Slot code currently requested by inspect_conversation")
          String slotCode,
      @ToolParam(required = true, description = "User-provided slot value") String value,
      ToolContext toolContext) {
    try {
      return stateService.updateSlot(sessionId(toolContext), slotCode, value);
    } catch (RuntimeException e) {
      log.warn("Workflow assistant update_slot failed: {}", e.getMessage());
      return AssistantConversationState.error("입력해주신 정보를 저장할 수 없습니다. 필요한 정보를 다시 확인해 주세요.");
    }
  }

  private Long sessionId(ToolContext toolContext) {
    Object value = contextValue(toolContext, SESSION_ID);
    if (value instanceof Number number) {
      return number.longValue();
    }
    if (value instanceof String text && !text.isBlank()) {
      return Long.parseLong(text);
    }
    throw new IllegalArgumentException("sessionId tool context is required");
  }

  private String textContext(ToolContext toolContext, String key) {
    Object value = contextValue(toolContext, key);
    return value == null ? "" : value.toString();
  }

  private Object contextValue(ToolContext toolContext, String key) {
    if (toolContext == null || toolContext.getContext() == null) {
      return null;
    }
    return toolContext.getContext().get(key);
  }
}
