package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.CreateSimulationGoldenCaseCommand;
import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
import com.init.workflowruntime.application.command.GetCurrentWorkflowCommand;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.command.InspectAssistantConversationCommand;
import com.init.workflowruntime.application.command.ReplaySimulationGoldenCaseCommand;
import com.init.workflowruntime.application.dto.AssistantConversationState;
import com.init.workflowruntime.application.dto.GenerateWorkflowAwareResponseResult;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolWorkflowResponse;
import com.init.workflowruntime.application.dto.SimulationGoldenCasePageResponse;
import com.init.workflowruntime.application.dto.SimulationGoldenCaseReplayResultPageResponse;
import com.init.workflowruntime.application.dto.SimulationGoldenCaseReplayResultResponse;
import com.init.workflowruntime.application.dto.SimulationGoldenCaseResponse;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
import com.init.workflowruntime.domain.SimulationGoldenCase;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayResult;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayResultRepository;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayStatus;
import com.init.workflowruntime.domain.SimulationGoldenCaseRepository;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SimulationGoldenCaseService {

  public static final String SIMULATION_REPLAY_CHANNEL = "SIMULATION_REPLAY";

  private static final String CUSTOMER_ROLE = "USER";
  private static final String MESSAGE_TYPE_TEXT = "TEXT";
  private static final int DEFAULT_PAGE = 0;
  private static final int DEFAULT_PAGE_SIZE = 20;
  private static final int MAX_PAGE_SIZE = 100;

  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final SimulationGoldenCaseRepository goldenCaseRepository;
  private final SimulationGoldenCaseReplayResultRepository replayResultRepository;
  private final DomainPackVersionRepository domainPackVersionRepository;
  private final IntentDefinitionRepository intentDefinitionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final LlmToolService llmToolService;
  private final LlmAssistantService llmAssistantService;
  private final WorkflowAssistantStateService workflowAssistantStateService;
  private final ChatSessionMetadataService chatSessionMetadataService;
  private final ObjectMapper objectMapper;

  public SimulationGoldenCaseService(
      ChatSessionRepository chatSessionRepository,
      ChatMessageRepository chatMessageRepository,
      SimulationGoldenCaseRepository goldenCaseRepository,
      SimulationGoldenCaseReplayResultRepository replayResultRepository,
      DomainPackVersionRepository domainPackVersionRepository,
      IntentDefinitionRepository intentDefinitionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      LlmToolService llmToolService,
      LlmAssistantService llmAssistantService,
      WorkflowAssistantStateService workflowAssistantStateService,
      ChatSessionMetadataService chatSessionMetadataService,
      ObjectMapper objectMapper) {
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.goldenCaseRepository = goldenCaseRepository;
    this.replayResultRepository = replayResultRepository;
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.llmToolService = llmToolService;
    this.llmAssistantService = llmAssistantService;
    this.workflowAssistantStateService = workflowAssistantStateService;
    this.chatSessionMetadataService = chatSessionMetadataService;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public SimulationGoldenCaseResponse createFromSession(CreateSimulationGoldenCaseCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    ChatSession sourceSession = findSimulationSession(command.workspaceId(), command.sessionId());
    ArrayNode inputMessages = inputMessagesJson(sourceSession.getId());
    if (inputMessages.isEmpty()) {
      throw new BadRequestException("GOLDEN_CASE_INPUT_REQUIRED", "검증 케이스로 저장할 고객 입력 메시지가 없습니다.");
    }

    String expectedJson = writeJson(buildExpectedSnapshot(command, sourceSession));
    SimulationGoldenCase saved =
        goldenCaseRepository.save(
            SimulationGoldenCase.create(
                command.workspaceId(),
                sourceSession.getId(),
                sourceSession.getDomainPackVersionId(),
                normalizeName(command.name(), sourceSession.getId()),
                writeJson(inputMessages),
                expectedJson,
                command.userId()));
    return toResponse(saved);
  }

  public SimulationGoldenCasePageResponse listGoldenCases(
      Long workspaceId, Long userId, int page, int size) {
    validateWorkspaceMembership(workspaceId, userId);
    DomainPage<SimulationGoldenCase> goldenCasePage =
        goldenCaseRepository.findByWorkspaceId(workspaceId, normalizedPageRequest(page, size));
    return new SimulationGoldenCasePageResponse(
        goldenCasePage.content().stream().map(this::toResponse).toList(),
        goldenCasePage.page(),
        goldenCasePage.size(),
        goldenCasePage.totalElements(),
        goldenCasePage.totalPages());
  }

  @Transactional
  public SimulationGoldenCaseReplayResultResponse replay(
      ReplaySimulationGoldenCaseCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    SimulationGoldenCase goldenCase = findGoldenCase(command.workspaceId(), command.goldenCaseId());
    DomainPackVersion version = findVersion(command.workspaceId(), command.domainPackVersionId());
    List<String> inputMessages = inputMessages(goldenCase);

    ChatSession replaySession =
        chatSessionRepository.save(
            ChatSession.create(
                command.workspaceId(),
                version.getId(),
                ChatSessionStatus.OPEN,
                SIMULATION_REPLAY_CHANNEL,
                replayMetaJson(goldenCase),
                command.userId()));
    for (String inputMessage : inputMessages) {
      replayCustomerInput(replaySession, inputMessage);
    }

    ObjectNode actualSnapshot = buildActualSnapshot(replaySession.getId(), command.userId());
    JsonNode expectedSnapshot = readJson(goldenCase.getExpectedJson(), "{}");
    List<String> failures = compareSnapshots(expectedSnapshot, actualSnapshot);
    SimulationGoldenCaseReplayStatus status =
        failures.isEmpty()
            ? SimulationGoldenCaseReplayStatus.PASS
            : SimulationGoldenCaseReplayStatus.FAIL;
    SimulationGoldenCaseReplayResult result =
        replayResultRepository.save(
            SimulationGoldenCaseReplayResult.record(
                command.workspaceId(),
                goldenCase.getId(),
                version.getId(),
                replaySession.getId(),
                status,
                goldenCase.getExpectedJson(),
                writeJson(actualSnapshot),
                failures.isEmpty() ? null : String.join("; ", failures),
                command.userId()));
    return SimulationGoldenCaseReplayResultResponse.from(result);
  }

  public SimulationGoldenCaseReplayResultPageResponse listReplayResults(
      Long workspaceId, Long userId, Long goldenCaseId, int page, int size) {
    validateWorkspaceMembership(workspaceId, userId);
    SimulationGoldenCase goldenCase = findGoldenCase(workspaceId, goldenCaseId);
    DomainPage<SimulationGoldenCaseReplayResult> replayPage =
        replayResultRepository.findByGoldenCaseId(
            goldenCase.getId(), normalizedPageRequest(page, size));
    return new SimulationGoldenCaseReplayResultPageResponse(
        replayPage.content().stream().map(SimulationGoldenCaseReplayResultResponse::from).toList(),
        replayPage.page(),
        replayPage.size(),
        replayPage.totalElements(),
        replayPage.totalPages());
  }

  private SimulationGoldenCaseResponse toResponse(SimulationGoldenCase goldenCase) {
    SimulationGoldenCaseReplayResultResponse latestReplayResult =
        replayResultRepository
            .findLatestByGoldenCaseId(goldenCase.getId())
            .map(SimulationGoldenCaseReplayResultResponse::from)
            .orElse(null);
    return SimulationGoldenCaseResponse.from(goldenCase, latestReplayResult);
  }

  private ObjectNode buildExpectedSnapshot(
      CreateSimulationGoldenCaseCommand command, ChatSession sourceSession) {
    LlmToolWorkflowResponse workflow =
        llmToolService.getCurrentWorkflowForOperator(
            new GetCurrentWorkflowCommand(sourceSession.getId()), command.userId());
    LlmToolContextResponse context =
        llmToolService.getContext(new GetLlmToolContextCommand(sourceSession.getId()));
    ObjectNode snapshot = objectMapper.createObjectNode();
    putNullable(
        snapshot,
        "intentCode",
        firstNonBlank(command.expectedIntentCode(), actualIntentCode(sourceSession, workflow)));
    putNullable(
        snapshot,
        "workflowCode",
        firstNonBlank(command.expectedWorkflowCode(), actualWorkflowCode(workflow)));
    putNullable(
        snapshot,
        "currentState",
        firstNonBlank(command.expectedCurrentState(), currentState(workflow)));
    putNullable(snapshot, "actionType", trimToNull(command.expectedActionType()));
    snapshot.set("slotValues", expectedSlotValues(command.expectedSlotValues(), context));
    return snapshot;
  }

  private ObjectNode buildActualSnapshot(Long replaySessionId, Long userId) {
    AssistantConversationState assistantState =
        workflowAssistantStateService
            .inspect(new InspectAssistantConversationCommand(replaySessionId))
            .state();
    LlmToolWorkflowResponse workflow =
        llmToolService.getCurrentWorkflowForOperator(
            new GetCurrentWorkflowCommand(replaySessionId), userId);
    ChatSession session =
        chatSessionRepository
            .findById(replaySessionId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "SESSION_NOT_FOUND", "Session not found: " + replaySessionId));
    LlmToolContextResponse context =
        llmToolService.getContext(new GetLlmToolContextCommand(replaySessionId));
    ObjectNode snapshot = objectMapper.createObjectNode();
    putNullable(snapshot, "intentCode", actualIntentCode(session, workflow));
    putNullable(snapshot, "workflowCode", actualWorkflowCode(workflow));
    putNullable(snapshot, "currentState", currentState(workflow));
    putNullable(
        snapshot,
        "actionType",
        assistantState != null && assistantState.nextAction() != null
            ? assistantState.nextAction().type()
            : null);
    snapshot.set("slotValues", objectNodeOrEmpty(context == null ? null : context.slotValues()));
    return snapshot;
  }

  private String actualIntentCode(ChatSession session, LlmToolWorkflowResponse workflow) {
    if (workflow == null
        || workflow.executionId() == null
        || workflow.workflowDefinitionId() == null) {
      return null;
    }
    return workflowDefinitionRepository
        .findByIdAndDomainPackVersionId(
            workflow.workflowDefinitionId(), session.getDomainPackVersionId())
        .flatMap(
            definition ->
                intentDefinitionRepository.findByIdAndDomainPackVersionId(
                    definition.getIntentDefinitionId(), session.getDomainPackVersionId()))
        .map(IntentDefinition::getIntentCode)
        .orElse(null);
  }

  private String actualWorkflowCode(LlmToolWorkflowResponse workflow) {
    if (workflow == null || workflow.executionId() == null) {
      return null;
    }
    return workflow.workflowCode();
  }

  private String currentState(LlmToolWorkflowResponse workflow) {
    return workflow == null ? null : workflow.currentState();
  }

  private void replayCustomerInput(ChatSession replaySession, String content) {
    ChatMessage customerMessage = saveMessage(replaySession, CUSTOMER_ROLE, content);
    chatSessionMetadataService.updateAfterMessage(replaySession, customerMessage);
    String conversationContext = buildConversationContext(replaySession.getId());
    GenerateWorkflowAwareResponseResult generated =
        llmAssistantService.generateWorkflowAwareResponse(
            new GenerateWorkflowAwareResponseCommand(
                replaySession.getId(), conversationContext, content));
    ChatMessage assistantMessage =
        saveMessage(replaySession, "ASSISTANT", normalizeAssistantContent(generated.content()));
    chatSessionMetadataService.updateAfterMessage(replaySession, assistantMessage);
  }

  private ChatMessage saveMessage(ChatSession session, String senderRole, String content) {
    Integer nextSeqNo =
        chatMessageRepository
            .findTopByChatSessionIdOrderBySeqNoDesc(session.getId())
            .map(message -> message.getSeqNo() + 1)
            .orElse(1);
    return chatMessageRepository.save(
        ChatMessage.create(
            session.getId(), nextSeqNo, senderRole, MESSAGE_TYPE_TEXT, normalizeContent(content)));
  }

  private String buildConversationContext(Long sessionId) {
    return chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(sessionId).stream()
        .sorted((left, right) -> left.getSeqNo().compareTo(right.getSeqNo()))
        .map(message -> message.getSenderRole() + ": " + nullToEmpty(message.getContent()))
        .reduce((left, right) -> left + "\n" + right)
        .orElse("");
  }

  private ArrayNode inputMessagesJson(Long sessionId) {
    ArrayNode inputMessages = objectMapper.createArrayNode();
    chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(sessionId).stream()
        .filter(this::isCustomerMessage)
        .forEach(
            message -> {
              ObjectNode item = objectMapper.createObjectNode();
              item.put("seqNo", message.getSeqNo());
              item.put("content", normalizeContent(message.getContent()));
              inputMessages.add(item);
            });
    return inputMessages;
  }

  private List<String> inputMessages(SimulationGoldenCase goldenCase) {
    JsonNode root = readJson(goldenCase.getInputMessagesJson(), "[]");
    if (!root.isArray()) {
      throw new BadRequestException("GOLDEN_CASE_INPUT_INVALID", "검증 케이스 입력 메시지 형식이 올바르지 않습니다.");
    }
    List<String> messages = new ArrayList<>();
    for (JsonNode item : root) {
      String content = trimToNull(item.path("content").asText(null));
      if (content != null) {
        messages.add(content);
      }
    }
    if (messages.isEmpty()) {
      throw new BadRequestException("GOLDEN_CASE_INPUT_REQUIRED", "검증 케이스 입력 메시지가 없습니다.");
    }
    return messages;
  }

  private boolean isCustomerMessage(ChatMessage message) {
    String senderRole = message.getSenderRole();
    return ("USER".equals(senderRole) || "CUSTOMER".equals(senderRole))
        && trimToNull(message.getContent()) != null;
  }

  private List<String> compareSnapshots(JsonNode expected, JsonNode actual) {
    List<String> failures = new ArrayList<>();
    compareText(expected, actual, "intentCode", failures);
    compareText(expected, actual, "workflowCode", failures);
    compareText(expected, actual, "currentState", failures);
    compareText(expected, actual, "actionType", failures);
    JsonNode expectedSlots = expected.path("slotValues");
    JsonNode actualSlots = actual.path("slotValues");
    if (expectedSlots.isObject()) {
      expectedSlots
          .fields()
          .forEachRemaining(
              entry -> {
                JsonNode expectedValue = entry.getValue();
                if (expectedValue == null || expectedValue.isNull()) {
                  return;
                }
                JsonNode actualValue = actualSlots.path(entry.getKey());
                if (!expectedValue.equals(actualValue)) {
                  failures.add(
                      "slotValues.%s expected %s but was %s"
                          .formatted(
                              entry.getKey(), expectedValue.toString(), jsonDisplay(actualValue)));
                }
              });
    }
    return failures;
  }

  private void compareText(
      JsonNode expected, JsonNode actual, String fieldName, List<String> failures) {
    String expectedValue = trimToNull(expected.path(fieldName).asText(null));
    if (expectedValue == null) {
      return;
    }
    String actualValue = trimToNull(actual.path(fieldName).asText(null));
    if (!expectedValue.equals(actualValue)) {
      failures.add("%s expected %s but was %s".formatted(fieldName, expectedValue, actualValue));
    }
  }

  private ChatSession findSimulationSession(Long workspaceId, Long sessionId) {
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
    if (!workspaceId.equals(session.getWorkspaceId())
        || !SimulationService.SIMULATION_CHANNEL.equals(session.getChannel())) {
      throw new NotFoundException(
          "SIMULATION_SESSION_NOT_FOUND", "Simulation session not found: " + sessionId);
    }
    return session;
  }

  private SimulationGoldenCase findGoldenCase(Long workspaceId, Long goldenCaseId) {
    return goldenCaseRepository
        .findByIdAndWorkspaceId(goldenCaseId, workspaceId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "SIMULATION_GOLDEN_CASE_NOT_FOUND", "검증 케이스를 찾을 수 없습니다: " + goldenCaseId));
  }

  private DomainPackVersion findVersion(Long workspaceId, Long versionId) {
    return domainPackVersionRepository
        .findByIdAndWorkspaceId(workspaceId, versionId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "DOMAIN_PACK_VERSION_NOT_FOUND",
                    "Domain Pack version not found: " + versionId));
  }

  private void validateWorkspaceMembership(Long workspaceId, Long userId) {
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));
  }

  private String replayMetaJson(SimulationGoldenCase goldenCase) {
    ObjectNode meta = objectMapper.createObjectNode();
    meta.put("simulationReplay", true);
    meta.put("goldenCaseId", goldenCase.getId());
    meta.put("sourceSessionId", goldenCase.getSourceChatSessionId());
    return writeJson(meta);
  }

  private DomainPageRequest normalizedPageRequest(int page, int size) {
    int normalizedPage = Math.max(DEFAULT_PAGE, page);
    int normalizedSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(MAX_PAGE_SIZE, Math.max(1, size));
    return new DomainPageRequest(normalizedPage, normalizedSize);
  }

  private ObjectNode objectNodeOrEmpty(JsonNode value) {
    if (value != null && value.isObject()) {
      return (ObjectNode) value;
    }
    return objectMapper.createObjectNode();
  }

  private ObjectNode expectedSlotValues(
      JsonNode expectedSlotValues, LlmToolContextResponse context) {
    if (expectedSlotValues == null || expectedSlotValues.isNull()) {
      return objectNodeOrEmpty(context == null ? null : context.slotValues());
    }
    if (!expectedSlotValues.isObject()) {
      throw new BadRequestException(
          "GOLDEN_CASE_EXPECTED_SLOTS_INVALID", "expectedSlotValues must be a JSON object");
    }
    return (ObjectNode) expectedSlotValues;
  }

  private JsonNode readJson(String json, String fallback) {
    try {
      return objectMapper.readTree(json == null || json.isBlank() ? fallback : json);
    } catch (JsonProcessingException e) {
      throw new BadRequestException("GOLDEN_CASE_JSON_INVALID", "검증 케이스 JSON 형식이 올바르지 않습니다.", e);
    }
  }

  private String writeJson(JsonNode value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException e) {
      throw new BadRequestException("GOLDEN_CASE_JSON_INVALID", "검증 케이스 JSON 형식이 올바르지 않습니다.", e);
    }
  }

  private void putNullable(ObjectNode node, String fieldName, String value) {
    String normalized = trimToNull(value);
    if (normalized == null) {
      node.putNull(fieldName);
    } else {
      node.put(fieldName, normalized);
    }
  }

  private String firstNonBlank(String first, String second) {
    String normalizedFirst = trimToNull(first);
    return normalizedFirst != null ? normalizedFirst : trimToNull(second);
  }

  private String normalizeName(String value, Long sessionId) {
    String normalized = trimToNull(value);
    return normalized != null ? normalized : "검증 케이스 #" + sessionId;
  }

  private String normalizeContent(String content) {
    String normalized = trimToNull(content);
    if (normalized == null) {
      throw new BadRequestException("MESSAGE_CONTENT_REQUIRED", "content is required");
    }
    return normalized;
  }

  private String normalizeAssistantContent(String content) {
    String normalized = trimToNull(content);
    return normalized != null ? normalized : "현재 응답을 생성할 수 없습니다. 입력 내용을 다시 확인해 주세요.";
  }

  private String jsonDisplay(JsonNode value) {
    return value == null || value.isMissingNode() ? "missing" : value.toString();
  }

  private String nullToEmpty(String value) {
    return value == null ? "" : value;
  }

  private String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
