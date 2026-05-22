package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.InternalException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.command.GetLlmToolSlotCommand;
import com.init.workflowruntime.application.command.ListLlmToolSlotsCommand;
import com.init.workflowruntime.application.command.UpsertLlmToolSlotValueCommand;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotValueResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
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
  private final SlotDefinitionRepository slotDefinitionRepository;
  private final IntentSlotBindingRepository intentSlotBindingRepository;
  private final ObjectMapper objectMapper;

  public LlmToolService(
      ChatSessionRepository chatSessionRepository,
      WorkflowExecutionRepository workflowExecutionRepository,
      SlotDefinitionRepository slotDefinitionRepository,
      IntentSlotBindingRepository intentSlotBindingRepository,
      ObjectMapper objectMapper) {
    this.chatSessionRepository = chatSessionRepository;
    this.workflowExecutionRepository = workflowExecutionRepository;
    this.slotDefinitionRepository = slotDefinitionRepository;
    this.intentSlotBindingRepository = intentSlotBindingRepository;
    this.objectMapper = objectMapper;
  }

  public LlmToolContextResponse getContext(GetLlmToolContextCommand command) {
    Long sessionId = command.sessionId();
    ChatSession session = findSession(sessionId);
    WorkflowExecution execution = findExecution(sessionId);
    ObjectNode slotValues =
        readObjectNode(execution != null ? execution.getSlotValuesJson() : "{}");
    List<LlmToolSlotResponse> slots = buildSlotResponses(session, execution, slotValues);
    List<String> missingSlots =
        slots.stream().filter(slot -> !slot.hasValue()).map(LlmToolSlotResponse::slotCode).toList();

    return new LlmToolContextResponse(
        session.getId(),
        session.getWorkspaceId(),
        session.getDomainPackVersionId(),
        execution != null ? execution.getId() : null,
        execution != null ? execution.getStatus() : null,
        execution != null ? execution.getCurrentState() : null,
        slotValues,
        missingSlots,
        slots);
  }

  public List<LlmToolSlotResponse> listSlots(ListLlmToolSlotsCommand command) {
    Long sessionId = command.sessionId();
    ChatSession session = findSession(sessionId);
    WorkflowExecution execution = findExecution(sessionId);
    ObjectNode slotValues =
        readObjectNode(execution != null ? execution.getSlotValuesJson() : "{}");
    return buildSlotResponses(session, execution, slotValues);
  }

  public LlmToolSlotResponse getSlot(GetLlmToolSlotCommand command) {
    Long sessionId = command.sessionId();
    String slotCode = command.slotCode();
    ChatSession session = findSession(sessionId);
    WorkflowExecution execution = findExecution(sessionId);
    ObjectNode slotValues =
        readObjectNode(execution != null ? execution.getSlotValuesJson() : "{}");
    SlotDefinition slot = findActiveSlot(session.getDomainPackVersionId(), slotCode);
    Map<Long, IntentSlotBinding> bindings = loadBindingsBySlotId(execution);
    return toSlotResponse(slot, bindings.get(slot.getId()), slotValues);
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
    findActiveSlot(session.getDomainPackVersionId(), slotCode);

    WorkflowExecution execution = findOrCreateExecutionForUpdate(session);
    ObjectNode slotValues = readObjectNode(execution.getSlotValuesJson());
    slotValues.set(slotCode, value.deepCopy());
    execution.replaceSlotValuesJson(writeJson(slotValues));
    WorkflowExecution saved = workflowExecutionRepository.save(execution);

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
}
