package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.TextNode;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.InternalException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.command.InspectAssistantConversationCommand;
import com.init.workflowruntime.application.command.SelectLlmToolIntentCommand;
import com.init.workflowruntime.application.command.StartAssistantWorkflowCommand;
import com.init.workflowruntime.application.command.UpdateAssistantSlotCommand;
import com.init.workflowruntime.application.command.UpsertLlmToolSlotValueCommand;
import com.init.workflowruntime.application.dto.AssistantConversationResult;
import com.init.workflowruntime.application.dto.AssistantConversationState;
import com.init.workflowruntime.application.dto.AssistantNextAction;
import com.init.workflowruntime.application.dto.AssistantWorkflowView;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotResponse;
import com.init.workflowruntime.application.dto.WorkflowAdvanceResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import com.init.workflowruntime.infrastructure.persistence.WorkflowMatchDecisionJdbcRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WorkflowAssistantStateService {

  private static final int MAX_AUTO_ADVANCE_COUNT = 5;
  private static final String ACTION_ADVANCE = "ADVANCE";
  private static final String ACTION_ASK_SLOT = "ASK_SLOT";
  private static final String ACTION_ANSWER = "ANSWER";
  private static final String ACTION_COMPLETED = "COMPLETED";
  private static final String ACTION_HANDOFF = "HANDOFF";
  private static final String ACTION_WAIT = "WAIT";
  private static final String ACTION_WAIT_CONDITION = "WAIT_CONDITION";
  private static final String DEFAULT_CURRENT_STEP = "현재 단계";

  private final LlmToolService llmToolService;
  private final WorkflowRuntimeService workflowRuntimeService;
  private final ChatSessionRepository chatSessionRepository;
  private final WorkflowExecutionRepository workflowExecutionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final WorkflowMatchDecisionJdbcRepository workflowMatchDecisionRepository;
  private final ObjectMapper objectMapper;

  public WorkflowAssistantStateService(
      LlmToolService llmToolService,
      WorkflowRuntimeService workflowRuntimeService,
      ChatSessionRepository chatSessionRepository,
      WorkflowExecutionRepository workflowExecutionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      WorkflowMatchDecisionJdbcRepository workflowMatchDecisionRepository,
      ObjectMapper objectMapper) {
    this.llmToolService = llmToolService;
    this.workflowRuntimeService = workflowRuntimeService;
    this.chatSessionRepository = chatSessionRepository;
    this.workflowExecutionRepository = workflowExecutionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.workflowMatchDecisionRepository = workflowMatchDecisionRepository;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public AssistantConversationResult inspect(InspectAssistantConversationCommand command) {
    return AssistantConversationResult.of(inspectState(command.sessionId()));
  }

  @Transactional
  public AssistantConversationResult startWorkflow(StartAssistantWorkflowCommand command) {
    String intentCode = command.intentCode();
    if (!hasText(intentCode)) {
      throw new BadRequestException("INTENT_CODE_REQUIRED", "intentCode is required");
    }
    Optional<Long> preferredWorkflow =
        workflowMatchDecisionRepository.findLatestConfidentWorkflowId(
            command.sessionId(), intentCode.trim());
    Long workflowDefinitionId = preferredWorkflow.orElse(null);
    llmToolService.selectIntent(
        new SelectLlmToolIntentCommand(
            command.sessionId(), intentCode.trim(), workflowDefinitionId));
    return AssistantConversationResult.of(inspectState(command.sessionId()));
  }

  @Transactional
  public AssistantConversationResult updateSlot(UpdateAssistantSlotCommand command) {
    String value = command.value();
    InspectedState inspectedState = inspectStateWithContext(command.sessionId());
    AssistantConversationState currentState = inspectedState.state();
    AssistantNextAction nextAction = currentState.nextAction();
    // 슬롯 요청 상태가 아니거나 값이 비어 있으면 저장하지 않고 현재 상태를 그대로 반환한다.
    // BadRequestException 을 던지면 공유 트랜잭션이 rollback-only 로 마킹되어 상위 호출(appendMessage)이
    // UnexpectedRollbackException 으로 깨지므로, 예외 대신 상태로 응답한다.
    if (!hasText(value)
        || nextAction == null
        || !ACTION_ASK_SLOT.equals(nextAction.type())
        || !hasText(nextAction.slotCode())) {
      return AssistantConversationResult.of(currentState);
    }
    // 값이 실제 답변이 아니라 안내 문구(질문 문장)나 필드 목록(슬롯 이름 나열)이면 저장하지 않는다.
    // LLM 이 사용자 입력이 없을 때 질문/필드목록을 그대로 슬롯 값으로 넣는 현상을 차단한다.
    if (looksLikePlaceholderValue(value, nextAction, inspectedState.context())) {
      return AssistantConversationResult.of(currentState);
    }
    // LLM 이 넘긴 slotCode 가 이 대화의 실제 슬롯이면 그대로 신뢰한다(사용자가 한 번에 여러 값을,
    // 또는 묻는 순서와 다르게 말해도 각 값이 올바른 슬롯에 저장된다). slotCode 가 비어 있거나
    // 한글 라벨/오타 등 알 수 없는 값이면 백엔드가 현재 요청 중인 슬롯으로 폴백한다.
    String targetSlot =
        resolveTargetSlot(inspectedState.context(), command.slotCode(), nextAction.slotCode());
    llmToolService.upsertSlotValue(
        new UpsertLlmToolSlotValueCommand(
            command.sessionId(), targetSlot, TextNode.valueOf(value.trim())));
    return AssistantConversationResult.of(inspectState(command.sessionId()));
  }

  private AssistantConversationState inspectState(Long sessionId) {
    return inspectStateWithContext(sessionId).state();
  }

  private InspectedState inspectStateWithContext(Long sessionId) {
    LlmToolContextResponse context = getContext(sessionId);
    if (!hasSelectedWorkflow(context)) {
      return new InspectedState(AssistantConversationState.needIntent(), context);
    }

    WorkflowAdvanceResponse advanceResponse = autoAdvance(sessionId);
    context = getContext(sessionId);
    return new InspectedState(toAssistantState(context, advanceResponse), context);
  }

  private WorkflowAdvanceResponse autoAdvance(Long sessionId) {
    WorkflowAdvanceResponse latest = null;
    Set<String> seenTransitions = new HashSet<>();
    for (int i = 0; i < MAX_AUTO_ADVANCE_COUNT; i++) {
      latest = workflowRuntimeService.advance(sessionId);
      if (latest == null) {
        throw new InternalException(
            "WORKFLOW_ADVANCE_EMPTY", "Workflow advance returned null response: " + sessionId);
      }
      String transitionKey = transitionKey(latest);
      if (!seenTransitions.add(transitionKey) || !ACTION_ADVANCE.equals(latest.actionType())) {
        return latest;
      }
    }
    return latest;
  }

  private AssistantConversationState toAssistantState(
      LlmToolContextResponse context, WorkflowAdvanceResponse advanceResponse) {
    if (advanceResponse == null) {
      return AssistantConversationState.needIntent();
    }

    AssistantWorkflowView workflow =
        new AssistantWorkflowView(context.executionStatus(), currentStep(context));
    if (!hasText(advanceResponse.actionType())) {
      return AssistantConversationState.error("일시적으로 대화 상태를 확인할 수 없습니다.");
    }
    return switch (advanceResponse.actionType()) {
      case ACTION_ASK_SLOT -> askSlotState(context, workflow, advanceResponse);
      case ACTION_ANSWER ->
          state(
              "IN_WORKFLOW",
              workflow,
              new AssistantNextAction(
                  ACTION_ANSWER, null, null, null, "고객의 요청에 대해 backend가 허용한 범위에서만 간결하게 답변하세요."),
              List.of());
      case ACTION_HANDOFF ->
          state(
              "HANDOFF_REQUIRED",
              workflow,
              new AssistantNextAction(
                  ACTION_HANDOFF,
                  null,
                  null,
                  "이 요청은 상담원 확인이 필요합니다.",
                  "상담원 확인이 필요하다고 안내하고 직접 처리 결과를 만들지 마세요."),
              List.of());
      case ACTION_COMPLETED ->
          state(
              ACTION_COMPLETED,
              workflow,
              new AssistantNextAction(
                  ACTION_COMPLETED, null, null, "요청 처리가 완료되었습니다.", "완료 사실만 간단히 안내하세요."),
              List.of());
      case ACTION_WAIT, ACTION_WAIT_CONDITION, ACTION_ADVANCE ->
          state(
              "WAITING",
              workflow,
              new AssistantNextAction(
                  ACTION_WAIT,
                  null,
                  "요청 내용을 조금 더 자세히 알려주시겠어요?",
                  null,
                  "추가 입력이 필요하므로 간단히 확인 질문을 하세요."),
              List.of());
      default -> AssistantConversationState.error("일시적으로 대화 상태를 확인할 수 없습니다.");
    };
  }

  private AssistantConversationState askSlotState(
      LlmToolContextResponse context,
      AssistantWorkflowView workflow,
      WorkflowAdvanceResponse advanceResponse) {
    List<String> missingSlotCodes = missingSlotCodes(advanceResponse);
    String slotCode = missingSlotCodes.isEmpty() ? null : missingSlotCodes.get(0);
    String question = composeSlotQuestion(context, missingSlotCodes, slotCode);
    return state(
        "IN_WORKFLOW",
        workflow,
        new AssistantNextAction(
            ACTION_ASK_SLOT,
            slotCode,
            question,
            null,
            "question에 안내된 필요한 정보를 한 번에 모두 고객에게 요청하세요. 고객이 실제로 제공한 값만 update_slot으로 저장하고, 제공하지 않은 값은 추측하지 마세요."),
        List.of("update_slot"));
  }

  private String composeSlotQuestion(
      LlmToolContextResponse context, List<String> missingSlotCodes, String firstSlotCode) {
    if (missingSlotCodes.size() <= 1) {
      return slotQuestion(findSlot(context, firstSlotCode), firstSlotCode);
    }
    List<String> labels =
        missingSlotCodes.stream().map(code -> slotLabel(findSlot(context, code), code)).toList();
    return "원활한 처리를 위해 다음 정보를 알려주세요: " + String.join(", ", labels) + ".";
  }

  private String slotLabel(LlmToolSlotResponse slot, String slotCode) {
    if (slot != null && hasText(slot.name())) {
      return slot.name();
    }
    return slotCode;
  }

  private AssistantConversationState state(
      String conversationStatus,
      AssistantWorkflowView workflow,
      AssistantNextAction nextAction,
      List<String> allowedTools) {
    return new AssistantConversationState(conversationStatus, workflow, nextAction, allowedTools);
  }

  private LlmToolSlotResponse findSlot(LlmToolContextResponse context, String slotCode) {
    if (!hasText(slotCode) || context.slots() == null) {
      return null;
    }
    return context.slots().stream()
        .filter(slot -> slotCode.equals(slot.slotCode()))
        .findFirst()
        .orElse(null);
  }

  private String slotQuestion(LlmToolSlotResponse slot, String slotCode) {
    if (slot != null && hasText(slot.promptHint())) {
      return slot.promptHint();
    }
    String name = slot != null && hasText(slot.name()) ? slot.name() : slotCode;
    if (!hasText(name)) {
      return "필요한 정보를 알려주시겠어요?";
    }
    return "%s를 알려주시겠어요?".formatted(name);
  }

  private String currentStep(LlmToolContextResponse context) {
    WorkflowExecution execution = findExecution(context.sessionId());
    if (execution == null || execution.getWorkflowDefinitionId() == null) {
      return DEFAULT_CURRENT_STEP;
    }
    ChatSession session = findSession(context.sessionId());
    WorkflowDefinition workflow =
        workflowDefinitionRepository
            .findByIdAndDomainPackVersionId(
                execution.getWorkflowDefinitionId(), session.getDomainPackVersionId())
            .orElse(null);
    if (workflow == null) {
      return DEFAULT_CURRENT_STEP;
    }
    String nodeLabel = nodeLabel(workflow, context.currentState());
    if (hasText(nodeLabel)) {
      return nodeLabel;
    }
    return hasText(workflow.getName()) ? workflow.getName() : DEFAULT_CURRENT_STEP;
  }

  private String nodeLabel(WorkflowDefinition workflow, String currentState) {
    if (!hasText(currentState) || !hasText(workflow.getGraphJson())) {
      return null;
    }
    JsonNode root = readJson(workflow.getGraphJson(), workflow.getId());
    for (JsonNode node : root.path("nodes")) {
      if (currentState.equals(node.path("id").asText(null))) {
        String label = trimToNull(node.path("label").asText(null));
        return label != null ? label : trimToNull(node.path("description").asText(null));
      }
    }
    return null;
  }

  private List<String> missingSlotCodes(WorkflowAdvanceResponse advanceResponse) {
    return advanceResponse.missingSlotCodes() == null
        ? List.of()
        : advanceResponse.missingSlotCodes();
  }

  private JsonNode readJson(String json, Long workflowId) {
    try {
      return objectMapper.readTree(json);
    } catch (JsonProcessingException e) {
      throw new InternalException(
          "WORKFLOW_GRAPH_PARSE_FAILED", "Workflow graphJson cannot be parsed: " + workflowId, e);
    }
  }

  private String transitionKey(WorkflowAdvanceResponse response) {
    return "%s:%s:%s:%s"
        .formatted(
            response.previousState(),
            response.currentState(),
            response.actionType(),
            response.edgeId());
  }

  private boolean hasSelectedWorkflow(LlmToolContextResponse context) {
    return context.executionId() != null && hasText(context.currentState());
  }

  private LlmToolContextResponse getContext(Long sessionId) {
    return llmToolService.getContext(new GetLlmToolContextCommand(sessionId));
  }

  private String resolveTargetSlot(
      LlmToolContextResponse context, String llmSlotCode, String requestedSlotCode) {
    if (hasText(llmSlotCode)) {
      String trimmed = llmSlotCode.trim();
      if (context.slots() != null) {
        for (LlmToolSlotResponse slot : context.slots()) {
          if (trimmed.equals(slot.slotCode())) {
            return trimmed;
          }
        }
      }
    }
    return requestedSlotCode;
  }

  private boolean looksLikePlaceholderValue(
      String value, AssistantNextAction nextAction, LlmToolContextResponse context) {
    String trimmed = value.trim();
    String question = nextAction.question();
    if (hasText(question) && (trimmed.equals(question.trim()) || question.contains(trimmed))) {
      return true;
    }
    if (context.slots() == null) {
      return false;
    }
    int slotNameHits = 0;
    String residual = trimmed;
    for (LlmToolSlotResponse slot : context.slots()) {
      if (hasText(slot.name()) && trimmed.contains(slot.name())) {
        slotNameHits++;
        residual = residual.replace(slot.name(), " ");
      }
    }
    // 슬롯 이름이 2개 이상 들어가 있고, 그 이름들을 제거했을 때 실질적인 내용(실제 값)이 남지 않으면
    // 사용자 답변이 아니라 필드 목록(안내 문구)으로 간주한다. "목적지는 제주도, 여행 인원은 2명"처럼
    // 실제 값이 함께 있는 다중 답변은 잔여 텍스트가 남으므로 거부하지 않는다.
    if (slotNameHits < 2) {
      return false;
    }
    String residualContent = residual.replaceAll("[^0-9a-z가-힣]", "");
    return residualContent.length() < 2;
  }

  private ChatSession findSession(Long sessionId) {
    return chatSessionRepository
        .findById(sessionId)
        .orElseThrow(
            () -> new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
  }

  private WorkflowExecution findExecution(Long sessionId) {
    return workflowExecutionRepository
        .findTopByChatSessionIdOrderByStartedAtDescIdDesc(sessionId)
        .orElse(null);
  }

  private boolean hasText(String value) {
    return trimToNull(value) != null;
  }

  private String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private record InspectedState(AssistantConversationState state, LlmToolContextResponse context) {}
}
