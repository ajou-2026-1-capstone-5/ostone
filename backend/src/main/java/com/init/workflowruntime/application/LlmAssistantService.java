package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.InternalException;
import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.command.ListLlmToolIntentsCommand;
import com.init.workflowruntime.application.command.SelectLlmToolIntentCommand;
import com.init.workflowruntime.application.command.UpsertLlmToolSlotValueCommand;
import com.init.workflowruntime.application.dto.GenerateWorkflowAwareResponseResult;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolIntentResponse;
import com.init.workflowruntime.application.dto.WorkflowAdvanceResponse;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
public class LlmAssistantService {

  private static final int MAX_ADVANCE_COUNT = 3;
  private static final double INTENT_CONFIDENCE_THRESHOLD = 0.5;
  private static final String ACTION_ADVANCE = "ADVANCE";

  private final ChatClient chatClient;
  private final LlmToolService llmToolService;
  private final WorkflowRuntimeService workflowRuntimeService;
  private final ObjectMapper objectMapper;

  public LlmAssistantService(
      ChatClient chatClient,
      LlmToolService llmToolService,
      WorkflowRuntimeService workflowRuntimeService,
      ObjectMapper objectMapper) {
    this.chatClient = chatClient;
    this.llmToolService = llmToolService;
    this.workflowRuntimeService = workflowRuntimeService;
    this.objectMapper = objectMapper;
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

  public GenerateWorkflowAwareResponseResult generateWorkflowAwareResponse(
      GenerateWorkflowAwareResponseCommand command) {
    Long sessionId = command.sessionId();
    String conversationContext = command.conversationContext();
    String userMessage = command.userMessage();
    LlmToolContextResponse context = getContext(sessionId);
    String responseDirective = null;

    if (!hasSelectedWorkflow(context)) {
      IntentDecision decision = selectIntent(sessionId, conversationContext, userMessage);
      if (decision.selectable()) {
        llmToolService.selectIntent(
            new SelectLlmToolIntentCommand(sessionId, decision.intentCode()));
        context = getContext(sessionId);
      } else {
        responseDirective = "사용자의 의도를 확정할 수 없으므로 가능한 업무 범위를 바탕으로 짧게 재질문한다.";
      }
    }

    if (responseDirective == null) {
      context = collectMissingSlots(sessionId, conversationContext, userMessage, context);
    }

    AdvanceTrace advanceTrace =
        responseDirective == null ? advanceWorkflow(sessionId) : emptyTrace();
    if (!advanceTrace.responses().isEmpty()) {
      context = getContext(sessionId);
    }

    String content =
        generateGroundedResponse(
            conversationContext, userMessage, context, advanceTrace.responses(), responseDirective);
    return new GenerateWorkflowAwareResponseResult(content);
  }

  private LlmToolContextResponse getContext(Long sessionId) {
    return llmToolService.getContext(new GetLlmToolContextCommand(sessionId));
  }

  private boolean hasSelectedWorkflow(LlmToolContextResponse context) {
    return context.executionId() != null && hasText(context.currentState());
  }

  private IntentDecision selectIntent(
      Long sessionId, String conversationContext, String userMessage) {
    List<LlmToolIntentResponse> intents =
        llmToolService.listIntents(new ListLlmToolIntentsCommand(sessionId));
    if (intents.isEmpty()) {
      return IntentDecision.unselected();
    }

    String prompt =
        """
        고객 메시지에 맞는 intentCode 하나를 고른다.
        반드시 아래 JSON 형식만 반환한다.
        {"intentCode":"...", "confidence":0.0, "reason":"..."}

        선택 가능한 intents:
        %s

        최근 대화:
        %s

        사용자 메시지:
        %s
        """
            .formatted(
                writeJson(intents), nullToEmpty(conversationContext), nullToEmpty(userMessage));
    String rawDecision = prompt(prompt);
    JsonNode decisionNode = readJsonObject(call(rawDecision));
    if (decisionNode == null) {
      return IntentDecision.unselected();
    }

    String intentCode = trimToNull(decisionNode.path("intentCode").asText(null));
    if (!isAllowedIntent(intentCode, intents)) {
      return IntentDecision.unselected();
    }

    JsonNode confidenceNode = decisionNode.get("confidence");
    if (confidenceNode == null || !confidenceNode.isNumber()) {
      return IntentDecision.unselected();
    }

    double confidence = confidenceNode.asDouble();
    if (confidence < INTENT_CONFIDENCE_THRESHOLD) {
      return IntentDecision.unselected();
    }

    return new IntentDecision(intentCode);
  }

  private LlmToolContextResponse collectMissingSlots(
      Long sessionId,
      String conversationContext,
      String userMessage,
      LlmToolContextResponse context) {
    List<String> missingSlots = context.missingSlots();
    if (missingSlots == null || missingSlots.isEmpty()) {
      return context;
    }

    String prompt =
        """
        사용자 메시지에서 workflow slot 값을 추출한다.
        값을 확신할 수 있는 항목만 values에 포함한다.
        반드시 아래 JSON 형식만 반환한다.
        {"values":[{"slotCode":"...", "value":...}]}

        필요한 slotCode 순서:
        %s

        슬롯 정의:
        %s

        최근 대화:
        %s

        사용자 메시지:
        %s
        """
            .formatted(
                writeJson(missingSlots),
                writeJson(context.slots()),
                nullToEmpty(conversationContext),
                nullToEmpty(userMessage));
    String rawExtraction = prompt(prompt);
    JsonNode extractionNode = readJsonObject(call(rawExtraction));
    if (extractionNode == null || !extractionNode.path("values").isArray()) {
      return context;
    }

    Set<String> allowedSlotCodes = new HashSet<>(missingSlots);
    boolean updated = false;
    for (JsonNode valueNode : extractionNode.path("values")) {
      String slotCode = trimToNull(valueNode.path("slotCode").asText(null));
      JsonNode value = valueNode.get("value");
      if (allowedSlotCodes.contains(slotCode) && hasUsableValue(value)) {
        llmToolService.upsertSlotValue(
            new UpsertLlmToolSlotValueCommand(sessionId, slotCode, value));
        updated = true;
      }
    }

    return updated ? getContext(sessionId) : context;
  }

  private AdvanceTrace advanceWorkflow(Long sessionId) {
    List<WorkflowAdvanceResponse> responses = new ArrayList<>();
    Set<String> seenTransitions = new HashSet<>();

    for (int i = 0; i < MAX_ADVANCE_COUNT; i++) {
      WorkflowAdvanceResponse response;
      try {
        response = workflowRuntimeService.advance(sessionId);
      } catch (BadRequestException e) {
        return new AdvanceTrace(responses);
      }
      responses.add(response);

      String transitionKey = transitionKey(response);
      if (!seenTransitions.add(transitionKey) || !ACTION_ADVANCE.equals(response.actionType())) {
        break;
      }
    }

    return new AdvanceTrace(responses);
  }

  private String generateGroundedResponse(
      String conversationContext,
      String userMessage,
      LlmToolContextResponse context,
      List<WorkflowAdvanceResponse> advanceResponses,
      String responseDirective) {
    String prompt =
        """
        아래 workflow tool 결과만 근거로 고객에게 한국어로 응답한다.
        없는 사실, 정책, 처리 결과를 만들지 않는다.
        ASK_SLOT이면 missingSlotCodes 배열의 첫 번째 slot부터 질문한다.
        HANDOFF이면 상담사 연결이 필요하다고 안내한다.
        COMPLETED이면 완료 사실을 간단히 안내한다.
        directive가 있으면 directive를 우선한다.

        directive:
        %s

        최근 대화:
        %s

        사용자 메시지:
        %s

        workflow context JSON:
        %s

        workflow advance JSON:
        %s
        """
            .formatted(
                nullToEmpty(responseDirective),
                nullToEmpty(conversationContext),
                nullToEmpty(userMessage),
                writeJson(context),
                writeJson(advanceResponses));
    String finalPrompt = prompt(prompt);
    return call(finalPrompt);
  }

  private String prompt(String value) {
    return value.stripIndent();
  }

  private String call(String prompt) {
    return chatClient
        .prompt()
        .user(u -> u.text("{prompt}").param("prompt", prompt))
        .call()
        .content();
  }

  private JsonNode readJsonObject(String rawContent) {
    String json = trimToNull(stripCodeFence(rawContent));
    if (json == null) {
      return null;
    }
    try {
      JsonNode parsed = objectMapper.readTree(json);
      return parsed.isObject() ? parsed : null;
    } catch (JsonProcessingException e) {
      return null;
    }
  }

  private String stripCodeFence(String rawContent) {
    String content = nullToEmpty(rawContent).trim();
    if (!content.startsWith("```")) {
      return content;
    }
    int firstNewLine = content.indexOf('\n');
    int lastFence = content.lastIndexOf("```");
    if (firstNewLine < 0 || lastFence <= firstNewLine) {
      return content;
    }
    return content.substring(firstNewLine + 1, lastFence).trim();
  }

  private String writeJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException e) {
      throw new InternalException(
          "JSON_SERIALIZE_FAILED", "Failed to serialize LLM prompt data", e);
    }
  }

  private boolean isAllowedIntent(String intentCode, List<LlmToolIntentResponse> intents) {
    if (intentCode == null) {
      return false;
    }
    return intents.stream().anyMatch(intent -> intentCode.equals(intent.intentCode()));
  }

  private boolean hasUsableValue(JsonNode value) {
    if (value == null || value.isNull() || value.isMissingNode()) {
      return false;
    }
    return !value.isTextual() || hasText(value.asText());
  }

  private String transitionKey(WorkflowAdvanceResponse response) {
    return "%s|%s|%s".formatted(response.currentState(), response.actionType(), response.edgeId());
  }

  private String nullToEmpty(String value) {
    return value == null ? "" : value;
  }

  private String trimToNull(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.trim();
  }

  private boolean hasText(String value) {
    return trimToNull(value) != null;
  }

  private AdvanceTrace emptyTrace() {
    return new AdvanceTrace(List.of());
  }

  private record IntentDecision(String intentCode) {
    private static IntentDecision unselected() {
      return new IntentDecision(null);
    }

    private boolean selectable() {
      return intentCode != null;
    }
  }

  private record AdvanceTrace(List<WorkflowAdvanceResponse> responses) {}
}
