package com.init.chatdemo.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.chatdemo.application.dto.ListDemoChatMessagesCommand;
import com.init.chatdemo.application.dto.ListDemoChatMessagesResult;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.AiResponseGenerationGuard;
import com.init.workflowruntime.application.ChatSessionMetadataService;
import com.init.workflowruntime.application.LlmAssistantService;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.exception.AiResponseInProgressException;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.retry.NonTransientAiException;
import org.springframework.ai.retry.TransientAiException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@Transactional(readOnly = true)
public class DemoChatSessionRegistrationService {

  private static final Logger log =
      LoggerFactory.getLogger(DemoChatSessionRegistrationService.class);
  private static final String DEFAULT_CHANNEL = "WEB";
  private static final String AI_FALLBACK_MESSAGE =
      "죄송합니다. 현재 자동 응답 생성이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.";

  private final ObjectMapper objectMapper = new ObjectMapper();
  private final DomainPackVersionRepository domainPackVersionRepository;
  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final LlmAssistantService llmAssistantService;
  private final SimpMessagingTemplate messagingTemplate;
  private final ApplicationEventPublisher eventPublisher;
  private final ChatSessionMetadataService chatSessionMetadataService;
  private final AiResponseGenerationGuard aiResponseGenerationGuard;

  public DemoChatSessionRegistrationService(
      DomainPackVersionRepository domainPackVersionRepository,
      ChatSessionRepository chatSessionRepository,
      ChatMessageRepository chatMessageRepository,
      LlmAssistantService llmAssistantService,
      SimpMessagingTemplate messagingTemplate,
      ApplicationEventPublisher eventPublisher,
      ChatSessionMetadataService chatSessionMetadataService,
      AiResponseGenerationGuard aiResponseGenerationGuard) {
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.llmAssistantService = llmAssistantService;
    this.messagingTemplate = messagingTemplate;
    this.eventPublisher = eventPublisher;
    this.chatSessionMetadataService = chatSessionMetadataService;
    this.aiResponseGenerationGuard = aiResponseGenerationGuard;
  }

  @Transactional
  public ChatSessionResponse createSession(Long workspaceId, String customerName) {
    String normalizedName = normalizeCustomerName(customerName);
    DomainPackVersion version =
        domainPackVersionRepository
            .findCurrentPublishedByWorkspaceId(workspaceId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "DOMAIN_PACK_CURRENT_VERSION_NOT_FOUND",
                        "현재 운영 중인 PUBLISHED version을 찾을 수 없습니다. workspaceId=" + workspaceId));

    ChatSession session =
        chatSessionRepository.save(
            ChatSession.create(
                workspaceId,
                version.getId(),
                ChatSessionStatus.OPEN,
                DEFAULT_CHANNEL,
                createMetaJson(normalizedName),
                null));

    ChatMessage greeting =
        chatMessageRepository.save(
            ChatMessage.create(
                session.getId(), 1, "ASSISTANT", "TEXT", createGreeting(normalizedName)));
    chatSessionMetadataService.updateAfterMessage(session, greeting);
    publishQueueUpsert(session);

    return ChatSessionResponse.from(session);
  }

  @Transactional
  public List<ChatMessageResponse> appendMessage(Long workspaceId, Long sessionId, String content) {
    String normalizedContent = normalizeMessageContent(content);
    Optional<AiResponseGenerationGuard.Lease> lease = aiResponseGenerationGuard.tryEnter(sessionId);
    if (lease.isEmpty()) {
      ensureSessionBelongsToWorkspace(workspaceId, sessionId);
      throw new AiResponseInProgressException();
    }

    try (AiResponseGenerationGuard.Lease ignored = lease.get()) {
      return appendMessageWithGenerationSlot(workspaceId, sessionId, normalizedContent);
    }
  }

  private List<ChatMessageResponse> appendMessageWithGenerationSlot(
      Long workspaceId, Long sessionId, String normalizedContent) {
    ChatSession session =
        chatSessionRepository
            .findByIdForUpdate(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
    if (!workspaceId.equals(session.getWorkspaceId())) {
      throw new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId);
    }

    int nextSeqNo =
        chatMessageRepository
            .findTopByChatSessionIdOrderBySeqNoDesc(sessionId)
            .map(message -> message.getSeqNo() + 1)
            .orElse(1);
    ChatMessage userMessage =
        chatMessageRepository.save(
            ChatMessage.create(sessionId, nextSeqNo, "USER", "TEXT", normalizedContent));
    chatSessionMetadataService.updateAfterMessage(session, userMessage);

    String assistantContent = generateAssistantContent(sessionId, normalizedContent);
    ChatMessage assistantMessage =
        chatMessageRepository.save(
            ChatMessage.create(sessionId, nextSeqNo + 1, "ASSISTANT", "TEXT", assistantContent));

    List<ChatMessageResponse> responses =
        List.of(ChatMessageResponse.from(userMessage), ChatMessageResponse.from(assistantMessage));
    publishQueueUpsert(session);
    broadcastAfterCommit(sessionId, responses);
    return responses;
  }

  private void ensureSessionBelongsToWorkspace(Long workspaceId, Long sessionId) {
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
    if (!workspaceId.equals(session.getWorkspaceId())) {
      throw new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId);
    }
  }

  public ListDemoChatMessagesResult listMessages(ListDemoChatMessagesCommand command) {
    ChatSession session =
        chatSessionRepository
            .findById(command.getSessionId())
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "SESSION_NOT_FOUND", "Session not found: " + command.getSessionId()));
    if (!command.getWorkspaceId().equals(session.getWorkspaceId())) {
      throw new NotFoundException(
          "SESSION_NOT_FOUND", "Session not found: " + command.getSessionId());
    }
    return new ListDemoChatMessagesResult(
        chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(command.getSessionId()).stream()
            .map(ChatMessageResponse::from)
            .toList());
  }

  private String normalizeCustomerName(String customerName) {
    if (customerName == null || customerName.isBlank()) {
      throw new BadRequestException("VALIDATION_ERROR", "customerName must not be blank");
    }
    return customerName.trim();
  }

  private String normalizeMessageContent(String content) {
    if (content == null || content.isBlank()) {
      throw new BadRequestException("VALIDATION_ERROR", "content must not be blank");
    }
    return content.trim();
  }

  private String createMetaJson(String customerName) {
    try {
      return objectMapper.writeValueAsString(
          Map.of("customerName", customerName, "handoffReason", "데모 채팅", "demo", true));
    } catch (JsonProcessingException e) {
      throw new BadRequestException("VALIDATION_ERROR", "customerName is invalid", e);
    }
  }

  private String createGreeting(String customerName) {
    return "안녕하세요, " + customerName + "님. 무엇을 도와드릴까요?";
  }

  private String createConversationContext(Long sessionId) {
    List<ChatMessage> recentDesc =
        chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(sessionId);
    return recentDesc.reversed().stream()
        .map(message -> message.getSenderRole() + ": " + message.getContent())
        .collect(Collectors.joining("\n"));
  }

  private void publishQueueUpsert(ChatSession session) {
    eventPublisher.publishEvent(
        new ConsultationQueueChangedEvent(
            session.getWorkspaceId(),
            session.getId(),
            ConsultationQueueEventType.SESSION_UPSERTED));
  }

  private String generateAssistantContent(Long sessionId, String normalizedContent) {
    try {
      return llmAssistantService.generateResponse(
          createConversationContext(sessionId), normalizedContent);
    } catch (NonTransientAiException | TransientAiException e) {
      log.warn("Demo chat AI response generation failed. sessionId={}", sessionId, e);
      return AI_FALLBACK_MESSAGE;
    }
  }

  private void broadcastAfterCommit(Long sessionId, List<ChatMessageResponse> responses) {
    Runnable broadcast =
        () ->
            responses.forEach(
                response -> messagingTemplate.convertAndSend("/topic/chat." + sessionId, response));
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
      runBroadcast(sessionId, broadcast);
      return;
    }
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            runBroadcast(sessionId, broadcast);
          }
        });
  }

  private void runBroadcast(Long sessionId, Runnable broadcast) {
    try {
      broadcast.run();
    } catch (RuntimeException e) {
      log.warn("Demo chat broadcast failed. sessionId={}", sessionId, e);
    }
  }
}
