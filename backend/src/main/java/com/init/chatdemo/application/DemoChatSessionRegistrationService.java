package com.init.chatdemo.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.LlmAssistantService;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DemoChatSessionRegistrationService {

  private static final String DEFAULT_CHANNEL = "WEB";

  private final ObjectMapper objectMapper = new ObjectMapper();
  private final DomainPackVersionRepository domainPackVersionRepository;
  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final LlmAssistantService llmAssistantService;

  public DemoChatSessionRegistrationService(
      DomainPackVersionRepository domainPackVersionRepository,
      ChatSessionRepository chatSessionRepository,
      ChatMessageRepository chatMessageRepository,
      LlmAssistantService llmAssistantService) {
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.llmAssistantService = llmAssistantService;
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

    chatMessageRepository.save(
        ChatMessage.create(
            session.getId(), 1, "ASSISTANT", "TEXT", createGreeting(normalizedName)));

    return ChatSessionResponse.from(session);
  }

  @Transactional
  public List<ChatMessageResponse> appendMessage(Long workspaceId, Long sessionId, String content) {
    String normalizedContent = normalizeMessageContent(content);
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
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

    String assistantContent =
        llmAssistantService.generateResponse(
            createConversationContext(sessionId), normalizedContent);
    ChatMessage assistantMessage =
        chatMessageRepository.save(
            ChatMessage.create(sessionId, nextSeqNo + 1, "ASSISTANT", "TEXT", assistantContent));

    return List.of(
        ChatMessageResponse.from(userMessage), ChatMessageResponse.from(assistantMessage));
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
        new ArrayList<>(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(sessionId));
    Collections.reverse(recentDesc);
    return recentDesc.stream()
        .map(message -> message.getSenderRole() + ": " + message.getContent())
        .collect(Collectors.joining("\n"));
  }
}
