package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.shared.application.exception.InternalException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.MessageDomainPackElementsResponse;
import com.init.workflowruntime.application.dto.MessageDomainPackElementsResponse.PolicyElement;
import com.init.workflowruntime.application.dto.MessageDomainPackElementsResponse.RiskElement;
import com.init.workflowruntime.application.dto.MessageDomainPackElementsResponse.SlotElement;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ConsultationEvidenceService {

  private static final String SIMULATION_CHANNEL = "SIMULATION";

  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final WorkflowExecutionRepository workflowExecutionRepository;
  private final SlotDefinitionRepository slotDefinitionRepository;
  private final PolicyDefinitionRepository policyDefinitionRepository;
  private final RiskDefinitionRepository riskDefinitionRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final ObjectMapper objectMapper;

  public ConsultationEvidenceService(
      ChatSessionRepository chatSessionRepository,
      ChatMessageRepository chatMessageRepository,
      WorkflowExecutionRepository workflowExecutionRepository,
      SlotDefinitionRepository slotDefinitionRepository,
      PolicyDefinitionRepository policyDefinitionRepository,
      RiskDefinitionRepository riskDefinitionRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      ObjectMapper objectMapper) {
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.workflowExecutionRepository = workflowExecutionRepository;
    this.slotDefinitionRepository = slotDefinitionRepository;
    this.policyDefinitionRepository = policyDefinitionRepository;
    this.riskDefinitionRepository = riskDefinitionRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.objectMapper = objectMapper;
  }

  public MessageDomainPackElementsResponse getMessageDomainPackElements(
      Long sessionId, Long messageId, Long userId) {
    ChatSession session = findSession(sessionId);
    validateWorkspaceMembership(session.getWorkspaceId(), userId);
    validateOperationalSession(session);
    validateMessageBelongsToSession(sessionId, messageId);

    WorkflowExecution execution =
        workflowExecutionRepository
            .findTopByChatSessionIdOrderByStartedAtDescIdDesc(sessionId)
            .orElse(null);

    ObjectNode slotValues =
        readObjectNode(execution != null ? execution.getSlotValuesJson() : "{}");
    JsonNode policySnapshot =
        readJsonNode(execution != null ? execution.getPolicySnapshotJson() : "{}", "{}");
    JsonNode riskSnapshot =
        readJsonNode(execution != null ? execution.getRiskSnapshotJson() : "{}", "{}");
    JsonNode currentPolicy = policySnapshot.path("currentPolicy");
    List<String> missingSlotCodes = textArray(currentPolicy.path("missingSlotCodes"));

    return new MessageDomainPackElementsResponse(
        session.getId(),
        messageId,
        session.getWorkspaceId(),
        session.getDomainPackVersionId(),
        execution != null ? execution.getId() : null,
        execution != null ? execution.getCurrentState() : null,
        buildSlots(session.getDomainPackVersionId(), slotValues, missingSlotCodes),
        buildPolicies(session.getDomainPackVersionId(), policySnapshot),
        buildRisks(session.getDomainPackVersionId(), riskSnapshot));
  }

  private List<SlotElement> buildSlots(
      Long domainPackVersionId, ObjectNode slotValues, List<String> missingSlotCodes) {
    return slotDefinitionRepository
        .findAllByDomainPackVersionIdOrderBySlotCodeAsc(domainPackVersionId)
        .stream()
        .filter(slot -> SlotDefinition.STATUS_ACTIVE.equals(slot.getStatus()))
        .filter(
            slot ->
                hasValue(slotValues, slot.getSlotCode())
                    || missingSlotCodes.contains(slot.getSlotCode()))
        .map(
            slot -> {
              JsonNode value = slotValues.path(slot.getSlotCode());
              return new SlotElement(
                  slot.getId(),
                  slot.getSlotCode(),
                  slot.getName(),
                  hasValue(slotValues, slot.getSlotCode()),
                  hasValue(slotValues, slot.getSlotCode()) ? formatSlotValue(slot, value) : null,
                  null);
            })
        .toList();
  }

  private List<PolicyElement> buildPolicies(Long domainPackVersionId, JsonNode policySnapshot) {
    Map<String, JsonNode> policyNodes = new LinkedHashMap<>();
    addPolicyNode(policyNodes, policySnapshot.path("currentPolicy"));
    addPolicyNodes(policyNodes, policySnapshot.path("hits"));
    addPolicyNodes(policyNodes, policySnapshot.path("policyHits"));

    List<PolicyElement> elements = new ArrayList<>();
    for (Map.Entry<String, JsonNode> entry : policyNodes.entrySet()) {
      String code = entry.getKey();
      JsonNode node = entry.getValue();
      PolicyDefinition definition =
          policyDefinitionRepository
              .findByDomainPackVersionIdAndPolicyCode(domainPackVersionId, code)
              .orElse(null);
      elements.add(
          new PolicyElement(
              definition != null ? definition.getId() : null,
              code,
              firstText(node, definition != null ? definition.getName() : code, "name"),
              true,
              node.path("matched").isMissingNode() || node.path("matched").asBoolean(true),
              textOrNull(node.path("reason")),
              textOrNull(node.path("nodeId")),
              null));
    }
    return elements;
  }

  private List<RiskElement> buildRisks(Long domainPackVersionId, JsonNode riskSnapshot) {
    List<JsonNode> riskNodes = new ArrayList<>();
    collectRiskNodes(riskSnapshot, riskNodes);

    Map<String, JsonNode> byCode = new LinkedHashMap<>();
    for (JsonNode node : riskNodes) {
      String code = firstText(node, null, "riskCode", "code", "riskRef");
      if (code != null) {
        byCode.putIfAbsent(code, node);
      }
    }

    List<RiskElement> elements = new ArrayList<>();
    for (Map.Entry<String, JsonNode> entry : byCode.entrySet()) {
      String code = entry.getKey();
      JsonNode node = entry.getValue();
      RiskDefinition definition =
          riskDefinitionRepository
              .findByDomainPackVersionIdAndRiskCode(domainPackVersionId, code)
              .orElse(null);
      String level =
          normalizeRiskLevel(
              firstText(
                  node,
                  definition != null ? definition.getRiskLevel() : "LOW",
                  "riskLevel",
                  "level"));
      elements.add(
          new RiskElement(
              definition != null ? definition.getId() : null,
              code,
              firstText(node, definition != null ? definition.getName() : code, "name"),
              true,
              level,
              null));
    }
    return elements;
  }

  private ChatSession findSession(Long sessionId) {
    return chatSessionRepository
        .findById(sessionId)
        .orElseThrow(
            () -> new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
  }

  private void validateMessageBelongsToSession(Long sessionId, Long messageId) {
    ChatMessage message =
        chatMessageRepository
            .findById(messageId)
            .orElseThrow(
                () ->
                    new NotFoundException("MESSAGE_NOT_FOUND", "Message not found: " + messageId));
    if (!sessionId.equals(message.getChatSessionId())) {
      throw new NotFoundException("MESSAGE_NOT_FOUND", "Message not found: " + messageId);
    }
  }

  private void validateWorkspaceMembership(Long workspaceId, Long userId) {
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));
  }

  private void validateOperationalSession(ChatSession session) {
    String channel = session.getChannel();
    if (channel != null && channel.toUpperCase(Locale.ROOT).startsWith(SIMULATION_CHANNEL)) {
      throw new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + session.getId());
    }
  }

  private void addPolicyNodes(Map<String, JsonNode> policyNodes, JsonNode nodes) {
    if (!nodes.isArray()) {
      return;
    }
    for (JsonNode node : nodes) {
      addPolicyNode(policyNodes, node);
    }
  }

  private void addPolicyNode(Map<String, JsonNode> policyNodes, JsonNode node) {
    if (node == null || !node.isObject()) {
      return;
    }
    String code = firstText(node, null, "policyCode", "code", "policyRef");
    if (code != null) {
      policyNodes.putIfAbsent(code, node);
    }
  }

  private void collectRiskNodes(JsonNode node, List<JsonNode> result) {
    if (node == null || node.isNull() || node.isMissingNode()) {
      return;
    }
    if (node.isArray()) {
      node.forEach(child -> collectRiskNodes(child, result));
      return;
    }
    if (!node.isObject()) {
      return;
    }

    if (firstText(node, null, "riskCode", "code", "riskRef") != null) {
      result.add(node);
    }
    collectRiskNodes(node.path("hits"), result);
    collectRiskNodes(node.path("riskHits"), result);
  }

  private List<String> textArray(JsonNode node) {
    if (!node.isArray()) {
      return List.of();
    }
    List<String> values = new ArrayList<>();
    node.forEach(
        item -> {
          String value = textOrNull(item);
          if (value != null) {
            values.add(value);
          }
        });
    return values;
  }

  private String firstText(JsonNode node, String fallback, String... fields) {
    if (node == null || node.isMissingNode() || node.isNull()) {
      return fallback;
    }
    for (String field : fields) {
      String value = textOrNull(node.path(field));
      if (value != null) {
        return value;
      }
    }
    return fallback;
  }

  private String textOrNull(JsonNode node) {
    if (node == null || node.isMissingNode() || node.isNull()) {
      return null;
    }
    String value = node.asText(null);
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.trim();
  }

  private boolean hasValue(ObjectNode slotValues, String slotCode) {
    return slotValues.hasNonNull(slotCode);
  }

  private String formatSlotValue(SlotDefinition slot, JsonNode value) {
    if (Boolean.TRUE.equals(slot.getIsSensitive())) {
      return "***";
    }
    if (value == null || value instanceof NullNode || value.isMissingNode()) {
      return null;
    }
    if (value.isTextual() || value.isNumber() || value.isBoolean()) {
      return value.asText();
    }
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException e) {
      throw new InternalException("JSON_WRITE_FAILED", "Slot value cannot be serialized", e);
    }
  }

  private String normalizeRiskLevel(String value) {
    if (value == null || value.isBlank()) {
      return "low";
    }
    return switch (value.trim().toUpperCase(Locale.ROOT)) {
      case "HIGH", "CRITICAL" -> "high";
      case "MEDIUM" -> "medium";
      default -> "low";
    };
  }

  private ObjectNode readObjectNode(String json) {
    JsonNode node = readJsonNode(json, "{}");
    if (node instanceof ObjectNode objectNode) {
      return objectNode;
    }
    throw new InternalException("JSON_OBJECT_EXPECTED", "Stored JSON value must be an object");
  }

  private JsonNode readJsonNode(String json, String defaultJson) {
    String source = json;
    if (source == null || source.isBlank()) {
      source = defaultJson;
    }
    try {
      return objectMapper.readTree(source);
    } catch (JsonProcessingException e) {
      throw new InternalException("JSON_PARSE_FAILED", "Stored JSON value cannot be parsed", e);
    }
  }
}
