package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.IntentWorkflowBinding;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.IntentWorkflowBindingRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.InternalException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.GetCurrentWorkflowCommand;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.command.GetLlmToolPolicyContextCommand;
import com.init.workflowruntime.application.command.GetLlmToolSlotCommand;
import com.init.workflowruntime.application.command.ListLlmToolIntentsCommand;
import com.init.workflowruntime.application.command.ListLlmToolSlotsCommand;
import com.init.workflowruntime.application.command.SelectLlmToolIntentCommand;
import com.init.workflowruntime.application.command.UpsertLlmToolSlotValueCommand;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolIntentResponse;
import com.init.workflowruntime.application.dto.LlmToolIntentSelectionResponse;
import com.init.workflowruntime.application.dto.LlmToolPolicyContextResponse;
import com.init.workflowruntime.application.dto.LlmToolPolicyResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotValueResponse;
import com.init.workflowruntime.application.dto.LlmToolWorkflowResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.DecisionLog;
import com.init.workflowruntime.domain.DecisionLogRepository;
import com.init.workflowruntime.domain.DecisionLogType;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import com.init.workflowruntime.domain.WorkflowExecutionStep;
import com.init.workflowruntime.domain.WorkflowExecutionStepActionType;
import com.init.workflowruntime.domain.WorkflowExecutionStepRepository;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class LlmToolService {

  private final ChatSessionRepository chatSessionRepository;
  private final WorkflowExecutionRepository workflowExecutionRepository;
  private final IntentDefinitionRepository intentDefinitionRepository;
  private final SlotDefinitionRepository slotDefinitionRepository;
  private final IntentSlotBindingRepository intentSlotBindingRepository;
  private final IntentWorkflowBindingRepository intentWorkflowBindingRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final WorkflowPolicyRuntimeService workflowPolicyRuntimeService;
  private final DecisionLogRepository decisionLogRepository;
  private final WorkflowExecutionStepRepository workflowExecutionStepRepository;
  private final ObjectMapper objectMapper;

  public LlmToolService(
      ChatSessionRepository chatSessionRepository,
      WorkflowExecutionRepository workflowExecutionRepository,
      IntentDefinitionRepository intentDefinitionRepository,
      SlotDefinitionRepository slotDefinitionRepository,
      IntentSlotBindingRepository intentSlotBindingRepository,
      IntentWorkflowBindingRepository intentWorkflowBindingRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      WorkflowPolicyRuntimeService workflowPolicyRuntimeService,
      DecisionLogRepository decisionLogRepository,
      WorkflowExecutionStepRepository workflowExecutionStepRepository,
      ObjectMapper objectMapper) {
    this.chatSessionRepository = chatSessionRepository;
    this.workflowExecutionRepository = workflowExecutionRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.slotDefinitionRepository = slotDefinitionRepository;
    this.intentSlotBindingRepository = intentSlotBindingRepository;
    this.intentWorkflowBindingRepository = intentWorkflowBindingRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.workflowPolicyRuntimeService = workflowPolicyRuntimeService;
    this.decisionLogRepository = decisionLogRepository;
    this.workflowExecutionStepRepository = workflowExecutionStepRepository;
    this.objectMapper = objectMapper;
  }

  @SuppressWarnings("java:S2201") // false positive: PESSIMISTIC_WRITE lock only, return ignored
  @Transactional
  public LlmToolWorkflowResponse getCurrentWorkflow(GetCurrentWorkflowCommand command) {
    Long sessionId = command.sessionId();
    ChatSession session = findSession(sessionId);
    WorkflowExecution execution = findExecution(sessionId);

    Long executionId = execution != null ? execution.getId() : null;
    String executionStatus = execution != null ? execution.getStatus() : null;
    String currentState = execution != null ? execution.getCurrentState() : null;
    Long workflowDefinitionId = execution != null ? execution.getWorkflowDefinitionId() : null;

    WorkflowDefinition definition = null;
    if (workflowDefinitionId != null) {
      definition =
          workflowDefinitionRepository
              .findByIdAndDomainPackVersionId(
                  workflowDefinitionId, session.getDomainPackVersionId())
              .orElse(null);
    }

    JsonNode graphJson = definition != null ? readJsonNode(definition.getGraphJson(), null) : null;
    JsonNode terminalStates =
        definition != null ? readJsonNode(definition.getTerminalStatesJson(), "[]") : null;
    if (terminalStates != null && !terminalStates.isArray()) {
      throw new InternalException(
          "JSON_PARSE_FAILED", "Stored terminalStatesJson must be a JSON array");
    }

    LlmToolWorkflowResponse response =
        new LlmToolWorkflowResponse(
            session.getId(),
            session.getWorkspaceId(),
            session.getDomainPackVersionId(),
            executionId,
            executionStatus,
            currentState,
            definition != null ? definition.getId() : null,
            definition != null ? definition.getWorkflowCode() : null,
            definition != null ? definition.getName() : null,
            definition != null ? definition.getDescription() : null,
            graphJson,
            definition != null ? definition.getInitialState() : null,
            terminalStates);

    if (execution != null) {
      workflowExecutionRepository.findLatestByChatSessionIdForUpdate(sessionId);
      int seq = nextStepSeqNo(execution.getId());
      decisionLogRepository.save(
          DecisionLog.record(
              execution.getId(),
              seq,
              DecisionLogType.WORKFLOW_FETCHED,
              execution.getIntentDefinitionId(),
              execution.getCurrentState(),
              null,
              null,
              "[]",
              "{}"));
    }

    return response;
  }

  @SuppressWarnings("java:S2201") // false positive: PESSIMISTIC_WRITE lock only, return ignored
  @Transactional
  public LlmToolContextResponse getContext(GetLlmToolContextCommand command) {
    Long sessionId = command.sessionId();
    ChatSession session = findSession(sessionId);
    WorkflowExecution execution = findExecution(sessionId);
    ObjectNode slotValues =
        readObjectNode(execution != null ? execution.getSlotValuesJson() : "{}");
    List<LlmToolSlotResponse> slots = buildSlotResponses(session, execution, slotValues);
    List<String> missingSlots =
        slots.stream().filter(slot -> !slot.hasValue()).map(LlmToolSlotResponse::slotCode).toList();
    JsonNode policySnapshot =
        readJsonNode(execution != null ? execution.getPolicySnapshotJson() : "{}", "{}");
    LlmToolPolicyResponse currentPolicy =
        execution != null
            ? workflowPolicyRuntimeService.evaluateCurrentPolicy(
                session.getDomainPackVersionId(), execution, slotValues)
            : null;

    LlmToolContextResponse response =
        new LlmToolContextResponse(
            session.getId(),
            session.getWorkspaceId(),
            session.getDomainPackVersionId(),
            execution != null ? execution.getId() : null,
            execution != null ? execution.getStatus() : null,
            execution != null ? execution.getCurrentState() : null,
            slotValues,
            policySnapshot,
            currentPolicy,
            missingSlots,
            slots);

    if (execution != null) {
      workflowExecutionRepository.findLatestByChatSessionIdForUpdate(sessionId);
      int seq = nextStepSeqNo(execution.getId());
      decisionLogRepository.save(
          DecisionLog.record(
              execution.getId(),
              seq,
              DecisionLogType.CONTEXT_FETCHED,
              execution.getIntentDefinitionId(),
              execution.getCurrentState(),
              null,
              null,
              writeJson(toJsonArray(missingSlots)),
              "{}"));
    }

    return response;
  }

  public LlmToolPolicyContextResponse getPolicyContext(GetLlmToolPolicyContextCommand command) {
    Long sessionId = command.sessionId();
    ChatSession session = findSession(sessionId);
    WorkflowExecution execution = findExecution(sessionId);
    if (execution == null) {
      return new LlmToolPolicyContextResponse(
          session.getId(), null, null, readJsonNode("{}", "{}"), null);
    }
    ObjectNode slotValues = readObjectNode(execution.getSlotValuesJson());
    LlmToolPolicyResponse currentPolicy =
        workflowPolicyRuntimeService.evaluateCurrentPolicy(
            session.getDomainPackVersionId(), execution, slotValues);
    JsonNode policySnapshot = readJsonNode(execution.getPolicySnapshotJson(), "{}");
    return new LlmToolPolicyContextResponse(
        session.getId(),
        execution.getId(),
        execution.getCurrentState(),
        policySnapshot,
        currentPolicy);
  }

  @SuppressWarnings("java:S2201") // false positive: PESSIMISTIC_WRITE lock only, return ignored
  @Transactional
  public List<LlmToolSlotResponse> listSlots(ListLlmToolSlotsCommand command) {
    Long sessionId = command.sessionId();
    ChatSession session = findSession(sessionId);
    WorkflowExecution execution = findExecution(sessionId);
    ObjectNode slotValues =
        readObjectNode(execution != null ? execution.getSlotValuesJson() : "{}");
    List<LlmToolSlotResponse> slots = buildSlotResponses(session, execution, slotValues);

    if (execution != null) {
      workflowExecutionRepository.findLatestByChatSessionIdForUpdate(sessionId);
      int seq = nextStepSeqNo(execution.getId());
      decisionLogRepository.save(
          DecisionLog.record(
              execution.getId(),
              seq,
              DecisionLogType.SLOTS_LISTED,
              execution.getIntentDefinitionId(),
              execution.getCurrentState(),
              null,
              null,
              "[]",
              writeJson(objectMapper.createObjectNode().put("returnedCount", slots.size()))));
    }

    return slots;
  }

  @SuppressWarnings("java:S2201") // false positive: PESSIMISTIC_WRITE lock only, return ignored
  @Transactional
  public LlmToolSlotResponse getSlot(GetLlmToolSlotCommand command) {
    Long sessionId = command.sessionId();
    String slotCode = command.slotCode();
    ChatSession session = findSession(sessionId);
    WorkflowExecution execution = findExecution(sessionId);
    ObjectNode slotValues =
        readObjectNode(execution != null ? execution.getSlotValuesJson() : "{}");
    SlotDefinition slot = findActiveSlot(session.getDomainPackVersionId(), slotCode);
    Map<Long, IntentSlotBinding> bindings = loadBindingsBySlotId(execution);
    LlmToolSlotResponse response = toSlotResponse(slot, bindings.get(slot.getId()), slotValues);

    if (execution != null) {
      workflowExecutionRepository.findLatestByChatSessionIdForUpdate(sessionId);
      int seq = nextStepSeqNo(execution.getId());
      decisionLogRepository.save(
          DecisionLog.record(
              execution.getId(),
              seq,
              DecisionLogType.SLOT_FETCHED,
              execution.getIntentDefinitionId(),
              execution.getCurrentState(),
              null,
              null,
              "[]",
              writeJson(objectMapper.createObjectNode().put("slotCode", slotCode))));
    }

    return response;
  }

  @SuppressWarnings("java:S2201") // false positive: PESSIMISTIC_WRITE lock only, return ignored
  @Transactional
  public List<LlmToolIntentResponse> listIntents(ListLlmToolIntentsCommand command) {
    Long sessionId = command.sessionId();
    ChatSession session = findSession(sessionId);
    List<LlmToolIntentResponse> result =
        intentDefinitionRepository
            .findByDomainPackVersionId(session.getDomainPackVersionId())
            .stream()
            .filter(intent -> !IntentDefinition.STATUS_REJECTED.equals(intent.getStatus()))
            .sorted(Comparator.comparing(IntentDefinition::getIntentCode))
            .map(this::toIntentResponse)
            .toList();

    WorkflowExecution execution = findExecution(sessionId);
    if (execution != null) {
      workflowExecutionRepository.findLatestByChatSessionIdForUpdate(sessionId);
      int seq = nextStepSeqNo(execution.getId());
      decisionLogRepository.save(
          DecisionLog.record(
              execution.getId(),
              seq,
              DecisionLogType.INTENTS_LISTED,
              execution.getIntentDefinitionId(),
              execution.getCurrentState(),
              null,
              null,
              "[]",
              writeJson(objectMapper.createObjectNode().put("returnedCount", result.size()))));
    }

    return result;
  }

  @Transactional
  public LlmToolIntentSelectionResponse selectIntent(SelectLlmToolIntentCommand command) {
    String intentCode = command.intentCode();
    if (intentCode == null || intentCode.isBlank()) {
      throw new BadRequestException("INTENT_CODE_REQUIRED", "intentCode is required");
    }

    ChatSession session = findSession(command.sessionId());
    IntentDefinition intent = findIntent(session.getDomainPackVersionId(), intentCode.trim());
    if (IntentDefinition.STATUS_REJECTED.equals(intent.getStatus())) {
      throw new BadRequestException(
          "INTENT_NOT_SELECTABLE", "Rejected intent cannot be selected: " + intentCode);
    }

    WorkflowDefinition workflow = resolveWorkflow(session.getDomainPackVersionId(), intent);
    WorkflowExecution execution = findOrCreateExecutionForUpdate(session);
    execution.assignIntentWorkflow(intent.getId(), workflow.getId(), resolveInitialState(workflow));
    WorkflowExecution saved = workflowExecutionRepository.save(execution);

    ObjectNode slotValues = readObjectNode(saved.getSlotValuesJson());
    List<LlmToolSlotResponse> requiredSlots =
        buildSlotResponses(session, saved, slotValues).stream()
            .filter(slot -> Boolean.TRUE.equals(slot.required()))
            .toList();
    List<String> missingRequiredSlots =
        requiredSlots.stream()
            .filter(slot -> !slot.hasValue())
            .map(LlmToolSlotResponse::slotCode)
            .toList();

    int seq = nextStepSeqNo(saved.getId());
    workflowExecutionStepRepository.save(
        WorkflowExecutionStep.record(
            saved.getId(),
            seq,
            null,
            saved.getCurrentState(),
            WorkflowExecutionStepActionType.ASSIGN_INTENT));
    decisionLogRepository.save(
        DecisionLog.record(
            saved.getId(),
            seq,
            DecisionLogType.INTENT_SELECTED,
            intent.getId(),
            saved.getCurrentState(),
            null,
            "ASSIGN_WORKFLOW",
            writeJson(toJsonArray(missingRequiredSlots)),
            writeJson(objectMapper.createObjectNode().put("intentCode", intent.getIntentCode()))));

    return new LlmToolIntentSelectionResponse(
        session.getId(),
        saved.getId(),
        intent.getId(),
        intent.getIntentCode(),
        intent.getName(),
        workflow.getId(),
        workflow.getWorkflowCode(),
        saved.getCurrentState(),
        !missingRequiredSlots.isEmpty(),
        missingRequiredSlots,
        requiredSlots);
  }

  @Transactional
  public LlmToolSlotValueResponse upsertSlotValue(UpsertLlmToolSlotValueCommand command) {
    Long sessionId = command.sessionId();
    String slotCode = command.slotCode();
    JsonNode value = command.value();
    if (value == null) {
      throw new BadRequestException("SLOT_VALUE_REQUIRED", "slot value is required");
    }

    ChatSession session = findSession(sessionId);
    SlotDefinition slotDef = findActiveSlot(session.getDomainPackVersionId(), slotCode);

    WorkflowExecution execution = findOrCreateExecutionForUpdate(session);
    ObjectNode slotValues = readObjectNode(execution.getSlotValuesJson());
    slotValues.set(slotCode, value.deepCopy());
    execution.replaceSlotValuesJson(writeJson(slotValues));
    WorkflowExecution saved = workflowExecutionRepository.save(execution);

    int seq = nextStepSeqNo(saved.getId());
    workflowExecutionStepRepository.save(
        WorkflowExecutionStep.record(
            saved.getId(),
            seq,
            saved.getCurrentState(),
            saved.getCurrentState(),
            WorkflowExecutionStepActionType.UPSERT_SLOT));

    ObjectNode payload = objectMapper.createObjectNode();
    payload.put("slotCode", slotCode);
    payload.set("value", maskSensitiveSlotValue(slotDef, value));
    decisionLogRepository.save(
        DecisionLog.record(
            saved.getId(),
            seq,
            DecisionLogType.SLOT_UPSERTED,
            saved.getIntentDefinitionId(),
            saved.getCurrentState(),
            null,
            null,
            "[]",
            writeJson(payload)));

    JsonNode savedValue = slotValues.get(slotCode);
    return new LlmToolSlotValueResponse(
        session.getId(), saved.getId(), slotCode, hasValue(slotValues, slotCode), savedValue);
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

  private WorkflowExecution findOrCreateExecutionForUpdate(ChatSession session) {
    Long sessionId = session.getId();
    if (sessionId == null) {
      throw new InternalException("SESSION_ID_MISSING", "Session ID cannot be null");
    }
    return workflowExecutionRepository
        .findLatestByChatSessionIdForUpdate(sessionId)
        .orElseGet(() -> workflowExecutionRepository.save(WorkflowExecution.create(sessionId)));
  }

  private int nextStepSeqNo(Long executionId) {
    return decisionLogRepository
        .findMaxStepSeqNoByExecutionId(executionId)
        .map(max -> max + 1)
        .orElse(1);
  }

  private JsonNode maskSensitiveSlotValue(SlotDefinition slotDef, JsonNode rawValue) {
    if (Boolean.TRUE.equals(slotDef.getIsSensitive())) {
      return TextNode.valueOf("***");
    }
    return rawValue;
  }

  private ArrayNode toJsonArray(List<String> codes) {
    ArrayNode arr = objectMapper.createArrayNode();
    for (String code : codes) {
      arr.add(code);
    }
    return arr;
  }

  private List<LlmToolSlotResponse> buildSlotResponses(
      ChatSession session, WorkflowExecution execution, ObjectNode slotValues) {
    Map<Long, IntentSlotBinding> bindings = loadBindingsBySlotId(execution);
    return slotDefinitionRepository
        .findAllByDomainPackVersionIdOrderBySlotCodeAsc(session.getDomainPackVersionId())
        .stream()
        .filter(slot -> SlotDefinition.STATUS_ACTIVE.equals(slot.getStatus()))
        .sorted(Comparator.comparing(SlotDefinition::getSlotCode))
        .map(slot -> toSlotResponse(slot, bindings.get(slot.getId()), slotValues))
        .toList();
  }

  private LlmToolSlotResponse toSlotResponse(
      SlotDefinition slot, IntentSlotBinding binding, ObjectNode slotValues) {
    String slotCode = slot.getSlotCode();
    return new LlmToolSlotResponse(
        slot.getId(),
        slotCode,
        slot.getName(),
        slot.getDescription(),
        slot.getDataType(),
        slot.getIsSensitive(),
        readJsonNode(slot.getValidationRuleJson(), "{}"),
        readJsonNode(slot.getDefaultValueJson(), null),
        readJsonNode(slot.getMetaJson(), "{}"),
        slot.getStatus(),
        binding != null ? binding.getIsRequired() : false,
        binding != null ? binding.getCollectionOrder() : null,
        binding != null ? binding.getPromptHint() : null,
        hasValue(slotValues, slotCode),
        slotValues.has(slotCode) ? slotValues.get(slotCode) : NullNode.getInstance());
  }

  private SlotDefinition findActiveSlot(Long domainPackVersionId, String slotCode) {
    SlotDefinition slot =
        slotDefinitionRepository
            .findByDomainPackVersionIdAndSlotCode(domainPackVersionId, slotCode)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "SLOT_DEFINITION_NOT_FOUND", "SlotDefinition not found: " + slotCode));
    if (!SlotDefinition.STATUS_ACTIVE.equals(slot.getStatus())) {
      throw new NotFoundException(
          "SLOT_DEFINITION_NOT_FOUND", "SlotDefinition not found: " + slotCode);
    }
    return slot;
  }

  private IntentDefinition findIntent(Long domainPackVersionId, String intentCode) {
    return intentDefinitionRepository
        .findByDomainPackVersionIdAndIntentCode(domainPackVersionId, intentCode)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "INTENT_DEFINITION_NOT_FOUND", "IntentDefinition not found: " + intentCode));
  }

  private WorkflowDefinition resolveWorkflow(Long domainPackVersionId, IntentDefinition intent) {
    List<IntentWorkflowBinding> bindings =
        intentWorkflowBindingRepository
            .findAllByIntentDefinitionIdIn(List.of(intent.getId()))
            .stream()
            .sorted(
                Comparator.comparing(
                        IntentWorkflowBinding::getIsPrimary,
                        Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(
                        IntentWorkflowBinding::getId,
                        Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
    if (bindings.isEmpty()) {
      throw new NotFoundException(
          "INTENT_WORKFLOW_BINDING_NOT_FOUND",
          "Intent workflow binding not found: " + intent.getIntentCode());
    }

    for (IntentWorkflowBinding binding : bindings) {
      var workflow =
          workflowDefinitionRepository.findByIdAndDomainPackVersionId(
              binding.getWorkflowDefinitionId(), domainPackVersionId);
      if (workflow.isPresent()) {
        return workflow.get();
      }
    }

    throw new NotFoundException(
        "WORKFLOW_DEFINITION_NOT_FOUND",
        "WorkflowDefinition not found for intent: " + intent.getIntentCode());
  }

  private String resolveInitialState(WorkflowDefinition workflow) {
    String initialState = trimToNull(workflow.getInitialState());
    if (initialState != null) {
      return initialState;
    }

    JsonNode graph = readJsonNode(workflow.getGraphJson(), null);
    for (JsonNode node : graph.path("nodes")) {
      if ("START".equals(node.path("type").asText(null))) {
        String nodeId = trimToNull(node.path("id").asText(null));
        if (nodeId != null) {
          return nodeId;
        }
      }
    }

    throw new InternalException(
        "WORKFLOW_INITIAL_STATE_MISSING",
        "Workflow initial state cannot be resolved: " + workflow.getId());
  }

  private LlmToolIntentResponse toIntentResponse(IntentDefinition intent) {
    return new LlmToolIntentResponse(
        intent.getId(),
        intent.getIntentCode(),
        intent.getName(),
        intent.getDescription(),
        intent.getTaxonomyLevel(),
        intent.getParentIntentId(),
        intent.getStatus(),
        readJsonNode(intent.getEntryConditionJson(), "{}"),
        readJsonNode(intent.getMetaJson(), "{}"));
  }

  private Map<Long, IntentSlotBinding> loadBindingsBySlotId(WorkflowExecution execution) {
    if (execution == null || execution.getIntentDefinitionId() == null) {
      return Map.of();
    }

    return intentSlotBindingRepository
        .findAllByIntentDefinitionIdIn(List.of(execution.getIntentDefinitionId()))
        .stream()
        .collect(
            Collectors.toMap(
                IntentSlotBinding::getSlotDefinitionId,
                Function.identity(),
                this::preferLowerCollectionOrder,
                LinkedHashMap::new));
  }

  private IntentSlotBinding preferLowerCollectionOrder(
      IntentSlotBinding left, IntentSlotBinding right) {
    Integer leftOrder = left.getCollectionOrder();
    Integer rightOrder = right.getCollectionOrder();
    if (leftOrder == null) {
      return rightOrder == null ? left : right;
    }
    if (rightOrder == null) {
      return left;
    }
    return leftOrder <= rightOrder ? left : right;
  }

  private ObjectNode readObjectNode(String json) {
    JsonNode node = readJsonNode(json, "{}");
    if (node.isObject()) {
      return (ObjectNode) node;
    }
    throw new InternalException("JSON_OBJECT_EXPECTED", "Stored JSON value must be an object");
  }

  private JsonNode readJsonNode(String json, String defaultJson) {
    String source = json;
    if (source == null || source.isBlank()) {
      source = defaultJson;
    }
    if (source == null) {
      return NullNode.getInstance();
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
      throw new InternalException("JSON_WRITE_FAILED", "Slot values cannot be serialized", e);
    }
  }

  private boolean hasValue(ObjectNode slotValues, String slotCode) {
    return slotValues.hasNonNull(slotCode);
  }

  private String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
