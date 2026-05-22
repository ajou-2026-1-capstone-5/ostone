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
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WorkflowRuntimeService {

  private static final String NODE_TYPE_ANSWER = "ANSWER";
  private static final String NODE_TYPE_HANDOFF = "HANDOFF";
  private static final String NODE_TYPE_TERMINAL = "TERMINAL";

  private final ChatSessionRepository chatSessionRepository;
  private final WorkflowExecutionRepository workflowExecutionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final WorkflowPolicyRuntimeService workflowPolicyRuntimeService;
  private final ObjectMapper objectMapper;

  public WorkflowRuntimeService(
      ChatSessionRepository chatSessionRepository,
      WorkflowExecutionRepository workflowExecutionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      WorkflowPolicyRuntimeService workflowPolicyRuntimeService,
      ObjectMapper objectMapper) {
    this.chatSessionRepository = chatSessionRepository;
    this.workflowExecutionRepository = workflowExecutionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.workflowPolicyRuntimeService = workflowPolicyRuntimeService;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public WorkflowAdvanceResponse advance(Long sessionId) {
    ChatSession session = findSession(sessionId);
    WorkflowExecution execution = findExecution(sessionId);
    WorkflowDefinition workflow = findWorkflow(session, execution);
    WorkflowRuntimeGraph graph =
        WorkflowRuntimeGraph.parse(objectMapper, workflow.getGraphJson(), workflow.getId());

    String previousState = requireCurrentState(execution);
    RuntimeNode currentNode = graph.requireNode(previousState);
    ObjectNode slotValues = readObjectNode(execution.getSlotValuesJson());
    LlmToolPolicyResponse sourcePolicy =
        evaluateNodePolicy(session, execution, currentNode, slotValues);
    JsonNode policySnapshot = workflowPolicyRuntimeService.buildPolicySnapshot(sourcePolicy);
    JsonNode riskSnapshot = readJsonNode(execution.getRiskSnapshotJson(), "{}");

    if (NODE_TYPE_TERMINAL.equals(currentNode.type())) {
      execution.complete();
      WorkflowExecution saved = workflowExecutionRepository.save(execution);
      return response(
          session,
          saved,
          previousState,
          currentNode,
          "COMPLETED",
          null,
          previousState,
          List.of(),
          NullNode.getInstance(),
          readObjectNode(saved.getSlotValuesJson()),
          null,
          false,
          "terminal state reached");
    }
    if (NODE_TYPE_HANDOFF.equals(currentNode.type())) {
      return response(
          session,
          execution,
          previousState,
          currentNode,
          "HANDOFF",
          null,
          previousState,
          List.of(),
          NullNode.getInstance(),
          slotValues,
          null,
          false,
          "current state requires counselor handoff");
    }
    if (NODE_TYPE_ANSWER.equals(currentNode.type())) {
      return response(
          session,
          execution,
          previousState,
          currentNode,
          "ANSWER",
          null,
          previousState,
          List.of(),
          NullNode.getInstance(),
          slotValues,
          null,
          false,
          "current state is answer node");
    }

    List<RuntimeEdge> outgoingEdges = graph.outgoingEdges(previousState);
    if (outgoingEdges.isEmpty()) {
      return response(
          session,
          execution,
          previousState,
          currentNode,
          "WAIT",
          null,
          previousState,
          List.of(),
          NullNode.getInstance(),
          slotValues,
          null,
          false,
          "current state has no outgoing edge");
    }

    RuntimeEdge defaultEdge = null;
    ConditionContext conditionContext =
        new ConditionContext(slotValues, policySnapshot, riskSnapshot);
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
        return advanceToEdge(
            session, execution, graph, previousState, currentNode, edge, sourcePolicy);
      }
    }

    if (defaultEdge != null) {
      return advanceToEdge(
          session, execution, graph, previousState, currentNode, defaultEdge, sourcePolicy);
    }

    List<String> missingSlotCodes =
        WorkflowConditionEvaluator.blockedSlotCodes(outgoingEdges, slotValues);
    if (!missingSlotCodes.isEmpty()) {
      return response(
          session,
          execution,
          previousState,
          currentNode,
          "ASK_SLOT",
          null,
          previousState,
          missingSlotCodes,
          NullNode.getInstance(),
          slotValues,
          null,
          false,
          "required slot values are missing");
    }

    return response(
        session,
        execution,
        previousState,
        currentNode,
        "WAIT_CONDITION",
        null,
        previousState,
        List.of(),
        NullNode.getInstance(),
        slotValues,
        null,
        false,
        "no edge condition matched");
  }

  private WorkflowAdvanceResponse advanceToEdge(
      ChatSession session,
      WorkflowExecution execution,
      WorkflowRuntimeGraph graph,
      String previousState,
      RuntimeNode previousNode,
      RuntimeEdge edge,
      LlmToolPolicyResponse sourcePolicy) {
    RuntimeNode targetNode = graph.requireNode(edge.to());
    execution.moveToState(targetNode.id());
    if (NODE_TYPE_TERMINAL.equals(targetNode.type())) {
      execution.complete();
    }
    LlmToolPolicyResponse transitionPolicy = transitionPolicyFor(edge, sourcePolicy);
    return response(
        session,
        execution,
        previousState,
        targetNode,
        actionTypeFor(targetNode),
        edge.id(),
        targetNode.id(),
        List.of(),
        edge.condition(),
        readObjectNode(execution.getSlotValuesJson()),
        transitionPolicy,
        true,
        "transitioned from " + previousNode.id() + " to " + targetNode.id());
  }

  private String actionTypeFor(RuntimeNode targetNode) {
    return switch (targetNode.type()) {
      case NODE_TYPE_ANSWER -> "ANSWER";
      case NODE_TYPE_HANDOFF -> "HANDOFF";
      case NODE_TYPE_TERMINAL -> "COMPLETED";
      default -> "ADVANCE";
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
        session.getDomainPackVersionId(), currentNode, slotValues, execution);
  }

  private LlmToolPolicyResponse transitionPolicyFor(
      RuntimeEdge edge, LlmToolPolicyResponse sourcePolicy) {
    String policyCode = policyHitCode(edge.condition());
    if (policyCode == null || sourcePolicy == null || !sourcePolicy.matched()) {
      return null;
    }
    return policyCode.equals(sourcePolicy.policyCode()) ? sourcePolicy : null;
  }

  private String policyHitCode(JsonNode condition) {
    if (condition == null || !"policy_hit".equals(condition.path("type").asText())) {
      return null;
    }
    String policyCode = condition.path("policyCode").asText(null);
    return trimToNull(policyCode);
  }

  private WorkflowAdvanceResponse response(
      ChatSession session,
      WorkflowExecution execution,
      String previousState,
      RuntimeNode currentNode,
      String actionType,
      String edgeId,
      String targetState,
      List<String> missingSlotCodes,
      JsonNode condition,
      ObjectNode slotValues,
      LlmToolPolicyResponse transitionPolicy,
      boolean persistExecution,
      String reason) {
    LlmToolPolicyResponse currentPolicy =
        workflowPolicyRuntimeService.evaluateNodePolicy(
            session.getDomainPackVersionId(), currentNode, slotValues, execution);
    JsonNode policySnapshot = workflowPolicyRuntimeService.buildPolicySnapshot(currentPolicy);
    String policySnapshotJson = writeJson(policySnapshot);
    boolean policySnapshotChanged = !policySnapshotJson.equals(execution.getPolicySnapshotJson());
    if (policySnapshotChanged) {
      execution.replacePolicySnapshotJson(policySnapshotJson);
    }
    WorkflowExecution responseExecution =
        persistExecution || policySnapshotChanged
            ? workflowExecutionRepository.save(execution)
            : execution;
    return new WorkflowAdvanceResponse(
        session.getId(),
        responseExecution.getId(),
        responseExecution.getStatus(),
        previousState,
        responseExecution.getCurrentState(),
        currentNode.type(),
        actionType,
        edgeId,
        targetState,
        missingSlotCodes,
        condition,
        policySnapshot,
        transitionPolicy,
        currentPolicy,
        reason);
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
