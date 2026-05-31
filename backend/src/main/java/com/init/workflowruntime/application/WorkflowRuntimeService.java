package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.InternalException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.WorkflowConditionEvaluator.ConditionContext;
import com.init.workflowruntime.application.WorkflowConditionEvaluator.ConditionEvaluation;
import com.init.workflowruntime.application.WorkflowRuntimeGraph.RuntimeEdge;
import com.init.workflowruntime.application.WorkflowRuntimeGraph.RuntimeNode;
import com.init.workflowruntime.application.dto.LlmToolPolicyResponse;
import com.init.workflowruntime.application.dto.WorkflowAdvanceResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import java.util.List;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WorkflowRuntimeService {

  private static final String NODE_TYPE_ANSWER = "ANSWER";
  private static final String NODE_TYPE_HANDOFF = "HANDOFF";
  private static final String NODE_TYPE_TERMINAL = "TERMINAL";
  private static final String ACTION_ADVANCE = "ADVANCE";
  private static final String ACTION_ASK_SLOT = "ASK_SLOT";
  private static final String ACTION_ANSWER = "ANSWER";
  private static final String ACTION_COMPLETED = "COMPLETED";
  private static final String ACTION_HANDOFF = "HANDOFF";
  private static final String ACTION_WAIT = "WAIT";
  private static final String ACTION_WAIT_CONDITION = "WAIT_CONDITION";
  private static final JsonNode NO_CONDITION = NullNode.getInstance();

  private final ChatSessionRepository chatSessionRepository;
  private final WorkflowExecutionRepository workflowExecutionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final WorkflowPolicyRuntimeService workflowPolicyRuntimeService;
  private final ChatSessionMetadataService chatSessionMetadataService;
  private final ApplicationEventPublisher eventPublisher;
  private final ObjectMapper objectMapper;

  public WorkflowRuntimeService(
      ChatSessionRepository chatSessionRepository,
      WorkflowExecutionRepository workflowExecutionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      WorkflowPolicyRuntimeService workflowPolicyRuntimeService,
      ChatSessionMetadataService chatSessionMetadataService,
      ApplicationEventPublisher eventPublisher,
      ObjectMapper objectMapper) {
    this.chatSessionRepository = chatSessionRepository;
    this.workflowExecutionRepository = workflowExecutionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.workflowPolicyRuntimeService = workflowPolicyRuntimeService;
    this.chatSessionMetadataService = chatSessionMetadataService;
    this.eventPublisher = eventPublisher;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public WorkflowAdvanceResponse advance(Long sessionId) {
    AdvanceContext context = loadAdvanceContext(sessionId);

    if (NODE_TYPE_TERMINAL.equals(context.currentNode().type())) {
      context.execution().complete();
      return completedResponse(context);
    }
    if (NODE_TYPE_HANDOFF.equals(context.currentNode().type())) {
      return handoffResponse(context);
    }
    if (NODE_TYPE_ANSWER.equals(context.currentNode().type())) {
      return answerResponse(context);
    }

    List<RuntimeEdge> outgoingEdges = context.graph().outgoingEdges(context.previousState());
    if (outgoingEdges.isEmpty()) {
      return waitResponse(context);
    }

    RuntimeEdge defaultEdge = null;
    ConditionContext conditionContext =
        new ConditionContext(
            context.slotValues(), context.policySnapshot(), context.riskSnapshot());
    for (RuntimeEdge edge : outgoingEdges) {
      if (WorkflowConditionEvaluator.isDefaultCondition(edge.condition())) {
        if (defaultEdge == null) {
          defaultEdge = edge;
        }
        continue;
      }
      ConditionEvaluation result =
          WorkflowConditionEvaluator.evaluate(edge.condition(), conditionContext);
      if (result.matched()) {
        return advanceToEdge(context, edge);
      }
    }

    if (defaultEdge != null) {
      return advanceToEdge(context, defaultEdge);
    }

    List<String> missingSlotCodes =
        WorkflowConditionEvaluator.blockedSlotCodes(outgoingEdges, context.slotValues());
    if (!missingSlotCodes.isEmpty()) {
      return askSlotResponse(context, missingSlotCodes);
    }

    return waitConditionResponse(context);
  }

  private AdvanceContext loadAdvanceContext(Long sessionId) {
    ChatSession session = findSession(sessionId);
    WorkflowExecution execution = findExecution(sessionId);
    WorkflowDefinition workflow = findWorkflow(session, execution);
    WorkflowRuntimeGraph graph =
        WorkflowRuntimeGraph.parse(objectMapper, workflow.getGraphJson(), workflow.getId());

    String previousState = requireCurrentState(execution);
    RuntimeNode currentNode = graph.requireNode(previousState);
    ObjectNode slotValues = readObjectNode(execution.getSlotValuesJson());
    LlmToolPolicyResponse currentPolicy =
        evaluateNodePolicy(session, execution, currentNode, slotValues);
    JsonNode policySnapshot = workflowPolicyRuntimeService.buildPolicySnapshot(currentPolicy);
    JsonNode riskSnapshot = readJsonNode(execution.getRiskSnapshotJson(), "{}");
    return AdvanceContext.of(
        session,
        execution,
        graph,
        previousState,
        currentNode,
        slotValues,
        currentPolicy,
        policySnapshot,
        riskSnapshot);
  }

  private WorkflowAdvanceResponse completedResponse(AdvanceContext context) {
    return currentNodeResponse(
        context, ACTION_COMPLETED, List.of(), true, "terminal state reached");
  }

  private WorkflowAdvanceResponse handoffResponse(AdvanceContext context) {
    return currentNodeResponse(
        context, ACTION_HANDOFF, List.of(), false, "current state requires counselor handoff");
  }

  private WorkflowAdvanceResponse answerResponse(AdvanceContext context) {
    return currentNodeResponse(
        context, ACTION_ANSWER, List.of(), false, "current state is answer node");
  }

  private WorkflowAdvanceResponse waitResponse(AdvanceContext context) {
    return currentNodeResponse(
        context, ACTION_WAIT, List.of(), false, "current state has no outgoing edge");
  }

  private WorkflowAdvanceResponse askSlotResponse(
      AdvanceContext context, List<String> missingSlotCodes) {
    return currentNodeResponse(
        context, ACTION_ASK_SLOT, missingSlotCodes, false, "required slot values are missing");
  }

  private WorkflowAdvanceResponse waitConditionResponse(AdvanceContext context) {
    return currentNodeResponse(
        context, ACTION_WAIT_CONDITION, List.of(), false, "no edge condition matched");
  }

  private WorkflowAdvanceResponse currentNodeResponse(
      AdvanceContext context,
      String actionType,
      List<String> missingSlotCodes,
      boolean persistExecution,
      String reason) {
    return response(
        context,
        ResponseDraft.currentNode(context, actionType, missingSlotCodes, persistExecution, reason));
  }

  private WorkflowAdvanceResponse advanceToEdge(AdvanceContext context, RuntimeEdge edge) {
    RuntimeNode targetNode = context.graph().requireNode(edge.to());
    context.execution().moveToState(targetNode.id());
    if (NODE_TYPE_TERMINAL.equals(targetNode.type())) {
      context.execution().complete();
    }
    ObjectNode slotValues = readObjectNode(context.execution().getSlotValuesJson());
    LlmToolPolicyResponse targetPolicy =
        evaluateNodePolicy(context.session(), context.execution(), targetNode, slotValues);
    JsonNode targetPolicySnapshot = workflowPolicyRuntimeService.buildPolicySnapshot(targetPolicy);
    LlmToolPolicyResponse transitionPolicy = transitionPolicyFor(context, edge);
    return response(
        context,
        ResponseDraft.transition(
            targetNode,
            actionTypeFor(targetNode),
            edge,
            targetPolicySnapshot,
            transitionPolicy,
            targetPolicy,
            "transitioned from " + context.currentNode().id() + " to " + targetNode.id()));
  }

  private String actionTypeFor(RuntimeNode targetNode) {
    return switch (targetNode.type()) {
      case NODE_TYPE_ANSWER -> ACTION_ANSWER;
      case NODE_TYPE_HANDOFF -> ACTION_HANDOFF;
      case NODE_TYPE_TERMINAL -> ACTION_COMPLETED;
      default -> ACTION_ADVANCE;
    };
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
        .orElseThrow(
            () ->
                new BadRequestException(
                    "WORKFLOW_EXECUTION_NOT_FOUND",
                    "Workflow execution not found for session: " + sessionId));
  }

  private WorkflowDefinition findWorkflow(ChatSession session, WorkflowExecution execution) {
    if (execution.getWorkflowDefinitionId() == null) {
      throw new BadRequestException("WORKFLOW_NOT_SELECTED", "Workflow is not selected");
    }
    return workflowDefinitionRepository
        .findByIdAndDomainPackVersionId(
            execution.getWorkflowDefinitionId(), session.getDomainPackVersionId())
        .orElseThrow(
            () ->
                new NotFoundException(
                    "WORKFLOW_DEFINITION_NOT_FOUND",
                    "WorkflowDefinition not found: " + execution.getWorkflowDefinitionId()));
  }

  private String requireCurrentState(WorkflowExecution execution) {
    String currentState = trimToNull(execution.getCurrentState());
    if (currentState == null) {
      throw new BadRequestException("WORKFLOW_STATE_MISSING", "Workflow currentState is missing");
    }
    return currentState;
  }

  private LlmToolPolicyResponse evaluateNodePolicy(
      ChatSession session,
      WorkflowExecution execution,
      RuntimeNode currentNode,
      ObjectNode slotValues) {
    return workflowPolicyRuntimeService.evaluateNodePolicy(
        new PolicyEvaluationCommand(
            session.getDomainPackVersionId(), currentNode, slotValues, execution));
  }

  private LlmToolPolicyResponse transitionPolicyFor(AdvanceContext context, RuntimeEdge edge) {
    LlmToolPolicyResponse sourcePolicy = context.currentPolicy();
    ConditionContext conditionContext =
        new ConditionContext(
            context.slotValues(), context.policySnapshot(), context.riskSnapshot());
    String policyCode = matchedPolicyHitCode(edge.condition(), conditionContext);
    if (policyCode == null || sourcePolicy == null || !sourcePolicy.matched()) {
      return null;
    }
    return policyCode.equals(sourcePolicy.policyCode()) ? sourcePolicy : null;
  }

  private String matchedPolicyHitCode(JsonNode condition, ConditionContext context) {
    if (condition == null || !condition.isObject()) {
      return null;
    }
    String type = condition.path("type").asText(null);
    if ("policy_hit".equals(type)) {
      ConditionEvaluation result = WorkflowConditionEvaluator.evaluate(condition, context);
      return result.matched() ? trimToNull(condition.path("policyCode").asText(null)) : null;
    }
    if ("all".equals(type)) {
      for (JsonNode child : condition.path("conditions")) {
        ConditionEvaluation result = WorkflowConditionEvaluator.evaluate(child, context);
        if (result.defaultCondition() || !result.matched()) {
          return null;
        }
        String policyCode = matchedPolicyHitCode(child, context);
        if (policyCode != null) {
          return policyCode;
        }
      }
    }
    if ("any".equals(type)) {
      for (JsonNode child : condition.path("conditions")) {
        ConditionEvaluation result = WorkflowConditionEvaluator.evaluate(child, context);
        if (!result.defaultCondition() && result.matched()) {
          return matchedPolicyHitCode(child, context);
        }
      }
    }
    return null;
  }

  private WorkflowAdvanceResponse response(AdvanceContext context, ResponseDraft draft) {
    recordHandoffIfNeeded(context, draft);
    WorkflowExecution execution = context.execution();
    String policySnapshotJson = writeJson(draft.policySnapshot());
    boolean policySnapshotChanged = !policySnapshotJson.equals(execution.getPolicySnapshotJson());
    if (policySnapshotChanged) {
      execution.replacePolicySnapshotJson(policySnapshotJson);
    }
    WorkflowExecution responseExecution =
        draft.persistExecution() || policySnapshotChanged
            ? workflowExecutionRepository.save(execution)
            : execution;
    return new WorkflowAdvanceResponse(
        context.session().getId(),
        responseExecution.getId(),
        responseExecution.getStatus(),
        context.previousState(),
        responseExecution.getCurrentState(),
        draft.node().type(),
        draft.actionType(),
        draft.edgeId(),
        draft.targetState(),
        draft.missingSlotCodes(),
        draft.condition(),
        draft.policySnapshot(),
        draft.transitionPolicy(),
        draft.currentPolicy(),
        draft.reason());
  }

  private void recordHandoffIfNeeded(AdvanceContext context, ResponseDraft draft) {
    if (!ACTION_HANDOFF.equals(draft.actionType())) {
      return;
    }
    boolean changed =
        chatSessionMetadataService.recordHandoff(
            context.session(), handoffReason(draft.node()), draft.node().id());
    if (changed) {
      eventPublisher.publishEvent(
          new ConsultationQueueChangedEvent(
              context.session().getWorkspaceId(),
              context.session().getId(),
              ConsultationQueueEventType.SESSION_UPSERTED));
    }
  }

  private String handoffReason(RuntimeNode node) {
    String description = trimToNull(node.description());
    if (description != null) {
      return description;
    }
    String label = trimToNull(node.label());
    return label != null ? label : "상담원 확인이 필요합니다.";
  }

  private record AdvanceContext(
      ChatSession session,
      WorkflowExecution execution,
      WorkflowRuntimeGraph graph,
      String previousState,
      RuntimeNode currentNode,
      ObjectNode slotValues,
      LlmToolPolicyResponse currentPolicy,
      JsonNode policySnapshot,
      JsonNode riskSnapshot) {

    private static AdvanceContext of(
        ChatSession session,
        WorkflowExecution execution,
        WorkflowRuntimeGraph graph,
        String previousState,
        RuntimeNode currentNode,
        ObjectNode slotValues,
        LlmToolPolicyResponse currentPolicy,
        JsonNode policySnapshot,
        JsonNode riskSnapshot) {
      return new AdvanceContext(
          session,
          execution,
          graph,
          previousState,
          currentNode,
          slotValues,
          currentPolicy,
          policySnapshot,
          riskSnapshot);
    }
  }

  private record ResponseDraft(
      RuntimeNode node,
      String actionType,
      String edgeId,
      String targetState,
      List<String> missingSlotCodes,
      JsonNode condition,
      JsonNode policySnapshot,
      LlmToolPolicyResponse transitionPolicy,
      LlmToolPolicyResponse currentPolicy,
      boolean persistExecution,
      String reason) {

    private static ResponseDraft currentNode(
        AdvanceContext context,
        String actionType,
        List<String> missingSlotCodes,
        boolean persistExecution,
        String reason) {
      return new ResponseDraft(
          context.currentNode(),
          actionType,
          null,
          context.previousState(),
          missingSlotCodes,
          NO_CONDITION,
          context.policySnapshot(),
          null,
          context.currentPolicy(),
          persistExecution,
          reason);
    }

    private static ResponseDraft transition(
        RuntimeNode targetNode,
        String actionType,
        RuntimeEdge edge,
        JsonNode policySnapshot,
        LlmToolPolicyResponse transitionPolicy,
        LlmToolPolicyResponse currentPolicy,
        String reason) {
      return new ResponseDraft(
          targetNode,
          actionType,
          edge.id(),
          targetNode.id(),
          List.of(),
          edge.condition(),
          policySnapshot,
          transitionPolicy,
          currentPolicy,
          true,
          reason);
    }
  }

  private ObjectNode readObjectNode(String json) {
    JsonNode node = readJsonNode(json, "{}");
    if (node.isObject()) {
      return (ObjectNode) node;
    }
    throw new InternalException("JSON_OBJECT_EXPECTED", "Stored JSON value must be an object");
  }

  private JsonNode readJsonNode(String json, String defaultJson) {
    String source = trimToNull(json);
    if (source == null) {
      source = defaultJson;
    }
    try {
      return objectMapper.readTree(source);
    } catch (JsonProcessingException e) {
      throw new InternalException("JSON_PARSE_FAILED", "Stored JSON value cannot be parsed", e);
    }
  }

  private String writeJson(JsonNode node) {
    try {
      return objectMapper.writeValueAsString(node);
    } catch (JsonProcessingException e) {
      throw new InternalException("JSON_WRITE_FAILED", "Policy snapshot cannot be serialized", e);
    }
  }

  private String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
