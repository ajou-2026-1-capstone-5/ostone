package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.CreateSimulationFeedbackCommand;
import com.init.workflowruntime.application.command.CreateSimulationSessionCommand;
import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
import com.init.workflowruntime.application.command.GetCurrentWorkflowCommand;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.command.SelectLlmToolIntentCommand;
import com.init.workflowruntime.application.command.SendSimulationMessageCommand;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.GenerateWorkflowAwareResponseResult;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolWorkflowResponse;
import com.init.workflowruntime.application.dto.SimulationFeedbackPageResponse;
import com.init.workflowruntime.application.dto.SimulationFeedbackSessionResponse;
import com.init.workflowruntime.application.dto.SimulationSessionDetailResponse;
import com.init.workflowruntime.application.dto.SimulationSessionPageResponse;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
import com.init.workflowruntime.domain.SimulationFeedback;
import com.init.workflowruntime.domain.SimulationFeedbackContent;
import com.init.workflowruntime.domain.SimulationFeedbackRepository;
import com.init.workflowruntime.domain.SimulationFeedbackStatus;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SimulationService {

  public static final String SIMULATION_CHANNEL = "SIMULATION";

  private static final String CUSTOMER_ROLE = "USER";
  private static final String ASSISTANT_ROLE = "ASSISTANT";
  private static final String MESSAGE_TYPE_TEXT = "TEXT";
  private static final int DEFAULT_PAGE = 0;
  private static final int DEFAULT_PAGE_SIZE = 20;
  private static final int MAX_PAGE_SIZE = 100;

  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final SimulationFeedbackRepository simulationFeedbackRepository;
  private final DomainPackVersionRepository domainPackVersionRepository;
  private final IntentDefinitionRepository intentDefinitionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final LlmToolService llmToolService;
  private final LlmAssistantService llmAssistantService;
  private final ChatSessionMetadataService chatSessionMetadataService;
  private final ObjectMapper objectMapper;

  public SimulationService(
      ChatSessionRepository chatSessionRepository,
      ChatMessageRepository chatMessageRepository,
      SimulationFeedbackRepository simulationFeedbackRepository,
      DomainPackVersionRepository domainPackVersionRepository,
      IntentDefinitionRepository intentDefinitionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      LlmToolService llmToolService,
      LlmAssistantService llmAssistantService,
      ChatSessionMetadataService chatSessionMetadataService,
      ObjectMapper objectMapper) {
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.simulationFeedbackRepository = simulationFeedbackRepository;
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.llmToolService = llmToolService;
    this.llmAssistantService = llmAssistantService;
    this.chatSessionMetadataService = chatSessionMetadataService;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public SimulationSessionDetailResponse createSession(CreateSimulationSessionCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    DomainPackVersion version = findCurrentVersion(command.workspaceId());

    Selection selection =
        resolveSelection(version.getId(), command.intentCode(), command.workflowDefinitionId());
    ChatSession session =
        ChatSession.create(
            command.workspaceId(),
            version.getId(),
            ChatSessionStatus.OPEN,
            SIMULATION_CHANNEL,
            createMetaJson(command.customerName(), selection),
            command.userId());
    ChatSession saved = chatSessionRepository.save(session);
    if (selection.intentCode() != null) {
      llmToolService.selectIntent(
          new SelectLlmToolIntentCommand(
              saved.getId(), selection.intentCode(), selection.workflowDefinitionId()));
    }
    return detail(saved, command.userId());
  }

  public SimulationSessionPageResponse listSessions(
      Long workspaceId, Long userId, int page, int size) {
    validateWorkspaceMembership(workspaceId, userId);
    DomainPageRequest pageRequest = normalizedPageRequest(page, size);
    DomainPage<ChatSession> sessionPage =
        chatSessionRepository.findByWorkspaceIdAndChannelOrderByStartedAtDesc(
            workspaceId, SIMULATION_CHANNEL, pageRequest);
    List<ChatSessionResponse> content =
        sessionPage.content().stream().map(ChatSessionResponse::from).toList();
    return new SimulationSessionPageResponse(
        content,
        sessionPage.page(),
        sessionPage.size(),
        sessionPage.totalElements(),
        sessionPage.totalPages());
  }

  @Transactional
  public SimulationSessionDetailResponse getSession(Long workspaceId, Long sessionId, Long userId) {
    validateWorkspaceMembership(workspaceId, userId);
    ChatSession session = findSimulationSession(workspaceId, sessionId);
    return detail(session, userId);
  }

  @Transactional
  public SimulationSessionDetailResponse createFeedback(CreateSimulationFeedbackCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    ChatSession session = findSimulationSession(command.workspaceId(), command.sessionId());
    validateFeedbackMessage(session.getId(), command.chatMessageId());
    SimulationFeedback feedback =
        SimulationFeedback.create(
            command.workspaceId(),
            session.getId(),
            command.chatMessageId(),
            new SimulationFeedbackContent(
                command.feedbackType(),
                command.description(),
                command.expectedBehavior(),
                command.severity()),
            command.userId());
    simulationFeedbackRepository.save(feedback);
    return detail(session, command.userId());
  }

  public SimulationFeedbackPageResponse listFeedback(
      Long workspaceId, Long userId, String status, int page, int size) {
    validateWorkspaceMembership(workspaceId, userId);
    SimulationFeedbackStatus parsedStatus = parseFeedbackStatus(status);
    DomainPageRequest pageRequest = normalizedPageRequest(page, size);
    DomainPage<SimulationFeedback> feedbackPage =
        parsedStatus == null
            ? simulationFeedbackRepository.findByWorkspaceId(workspaceId, pageRequest)
            : simulationFeedbackRepository.findByWorkspaceIdAndStatus(
                workspaceId, parsedStatus, pageRequest);
    return SimulationFeedbackPageResponse.from(feedbackPage);
  }

  @Transactional
  public SimulationSessionDetailResponse sendMessage(SendSimulationMessageCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    ChatSession session =
        findSimulationSessionForUpdate(command.workspaceId(), command.sessionId());
    String content = normalizeContent(command.content());

    ChatMessage customerMessage = saveMessage(session, CUSTOMER_ROLE, content);
    chatSessionMetadataService.updateAfterMessage(session, customerMessage);

    String conversationContext = buildConversationContext(session.getId());
    GenerateWorkflowAwareResponseResult generated =
        llmAssistantService.generateWorkflowAwareResponse(
            new GenerateWorkflowAwareResponseCommand(
                session.getId(), conversationContext, content));
    ChatMessage assistantMessage =
        saveMessage(session, ASSISTANT_ROLE, normalizeAssistantContent(generated.content()));
    chatSessionMetadataService.updateAfterMessage(session, assistantMessage);

    return detail(session, command.userId());
  }

  private DomainPackVersion findCurrentVersion(Long workspaceId) {
    return domainPackVersionRepository
        .findCurrentPublishedByWorkspaceId(workspaceId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "DOMAIN_PACK_CURRENT_VERSION_NOT_FOUND",
                    "현재 운영 중인 PUBLISHED version을 찾을 수 없습니다. workspaceId=" + workspaceId));
  }

  private Selection resolveSelection(
      Long domainPackVersionId, String intentCode, Long workflowDefinitionId) {
    String normalizedIntentCode = trimToNull(intentCode);
    Long selectedWorkflowId = workflowDefinitionId;
    if (selectedWorkflowId == null) {
      return new Selection(normalizedIntentCode, null);
    }

    WorkflowDefinition workflow =
        workflowDefinitionRepository
            .findByIdAndDomainPackVersionId(selectedWorkflowId, domainPackVersionId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "WORKFLOW_DEFINITION_NOT_FOUND",
                        "WorkflowDefinition not found: " + selectedWorkflowId));
    if (normalizedIntentCode == null) {
      IntentDefinition intent =
          intentDefinitionRepository
              .findByIdAndDomainPackVersionId(workflow.getIntentDefinitionId(), domainPackVersionId)
              .orElseThrow(
                  () ->
                      new NotFoundException(
                          "INTENT_DEFINITION_NOT_FOUND",
                          "IntentDefinition not found: " + workflow.getIntentDefinitionId()));
      normalizedIntentCode = intent.getIntentCode();
    }
    return new Selection(normalizedIntentCode, selectedWorkflowId);
  }

  private ChatSession findSimulationSession(Long workspaceId, Long sessionId) {
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
    validateSimulationSession(workspaceId, session);
    return session;
  }

  private ChatSession findSimulationSessionForUpdate(Long workspaceId, Long sessionId) {
    ChatSession session =
        chatSessionRepository
            .findByIdForUpdate(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
    validateSimulationSession(workspaceId, session);
    ChatSessionStatus status = session.getStatus();
    if (status != ChatSessionStatus.OPEN && status != ChatSessionStatus.ACTIVE) {
      throw new BadRequestException(
          "SESSION_NOT_OPEN_OR_ACTIVE",
          "Session " + sessionId + " is not open or active; current status: " + status);
    }
    return session;
  }

  private void validateSimulationSession(Long workspaceId, ChatSession session) {
    if (!workspaceId.equals(session.getWorkspaceId())
        || !SIMULATION_CHANNEL.equals(session.getChannel())) {
      throw new NotFoundException(
          "SIMULATION_SESSION_NOT_FOUND", "Simulation session not found: " + session.getId());
    }
  }

  private void validateFeedbackMessage(Long sessionId, Long chatMessageId) {
    if (chatMessageId == null) {
      return;
    }
    ChatMessage message =
        chatMessageRepository
            .findById(chatMessageId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "SIMULATION_MESSAGE_NOT_FOUND",
                        "Simulation message not found: " + chatMessageId));
    if (!sessionId.equals(message.getChatSessionId())) {
      throw new NotFoundException(
          "SIMULATION_MESSAGE_NOT_FOUND", "Simulation message not found: " + chatMessageId);
    }
  }

  private SimulationFeedbackStatus parseFeedbackStatus(String status) {
    if (status == null || status.isBlank()) {
      return null;
    }
    try {
      return SimulationFeedbackStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
    } catch (IllegalArgumentException e) {
      throw new BadRequestException("INVALID_FEEDBACK_STATUS", "지원하지 않는 피드백 상태입니다: " + status);
    }
  }

  private void validateWorkspaceMembership(Long workspaceId, Long userId) {
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));
  }

  private SimulationSessionDetailResponse detail(ChatSession session, Long userId) {
    List<ChatMessageResponse> messages =
        chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(session.getId()).stream()
            .map(ChatMessageResponse::from)
            .toList();
    LlmToolWorkflowResponse matchedWorkflow =
        llmToolService.getCurrentWorkflowForOperator(
            new GetCurrentWorkflowCommand(session.getId()), userId);
    LlmToolContextResponse context =
        llmToolService.getContext(new GetLlmToolContextCommand(session.getId()));
    return new SimulationSessionDetailResponse(
        ChatSessionResponse.from(session),
        messages,
        matchedWorkflow,
        context.slotValues(),
        context.slots(),
        SimulationFeedbackSessionResponse.from(
            simulationFeedbackRepository.findByChatSessionIdOrderByCreatedAtAsc(session.getId())));
  }

  private ChatMessage saveMessage(ChatSession session, String senderRole, String content) {
    Integer nextSeqNo =
        chatMessageRepository
            .findTopByChatSessionIdOrderBySeqNoDesc(session.getId())
            .map(message -> message.getSeqNo() + 1)
            .orElse(1);
    return chatMessageRepository.save(
        ChatMessage.create(session.getId(), nextSeqNo, senderRole, MESSAGE_TYPE_TEXT, content));
  }

  private String buildConversationContext(Long sessionId) {
    return chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(sessionId).stream()
        .sorted((left, right) -> left.getSeqNo().compareTo(right.getSeqNo()))
        .map(message -> message.getSenderRole() + ": " + nullToEmpty(message.getContent()))
        .reduce((left, right) -> left + "\n" + right)
        .orElse("");
  }

  private String createMetaJson(String customerName, Selection selection) {
    try {
      ObjectNode meta = objectMapper.createObjectNode();
      meta.put("simulation", true);
      meta.put(
          "customerName",
          customerName != null && !customerName.isBlank() ? customerName.trim() : "시뮬레이션 고객");
      meta.put("selectedIntentCode", nullToEmpty(selection.intentCode()));
      if (selection.workflowDefinitionId() != null) {
        meta.put("selectedWorkflowDefinitionId", selection.workflowDefinitionId());
      } else {
        meta.putNull("selectedWorkflowDefinitionId");
      }
      return objectMapper.writeValueAsString(meta);
    } catch (JsonProcessingException e) {
      throw new BadRequestException("VALIDATION_ERROR", "simulation metadata is invalid", e);
    }
  }

  private DomainPageRequest normalizedPageRequest(int page, int size) {
    int normalizedPage = Math.max(DEFAULT_PAGE, page);
    int normalizedSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(MAX_PAGE_SIZE, Math.max(1, size));
    return new DomainPageRequest(normalizedPage, normalizedSize);
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

  private record Selection(String intentCode, Long workflowDefinitionId) {}
}
