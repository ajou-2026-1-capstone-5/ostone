package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.GetOrCreateCurrentSessionCommand;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.util.List;
import java.util.Map;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserChatSessionService {

  private static final String DEFAULT_CHANNEL = "WEB";
  private static final List<ChatSessionStatus> REUSABLE_STATUSES =
      List.of(ChatSessionStatus.OPEN, ChatSessionStatus.ACTIVE);

  private final ObjectMapper objectMapper = new ObjectMapper();
  private final ChatSessionRepository chatSessionRepository;
  private final DomainPackVersionRepository domainPackVersionRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final UserChatSessionConcurrencyGuard concurrencyGuard;
  private final ApplicationEventPublisher eventPublisher;

  public UserChatSessionService(
      ChatSessionRepository chatSessionRepository,
      DomainPackVersionRepository domainPackVersionRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      UserChatSessionConcurrencyGuard concurrencyGuard,
      ApplicationEventPublisher eventPublisher) {
    this.chatSessionRepository = chatSessionRepository;
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.concurrencyGuard = concurrencyGuard;
    this.eventPublisher = eventPublisher;
  }

  @Transactional
  public ChatSessionResponse getOrCreateCurrentSession(GetOrCreateCurrentSessionCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    concurrencyGuard.lockCurrentSession(command.workspaceId(), command.userId());

    return chatSessionRepository
        .findFirstByWorkspaceIdAndStartedByAndStatusInOrderByStartedAtDescIdDesc(
            command.workspaceId(), command.userId(), REUSABLE_STATUSES)
        .map(
            session ->
                ChatSessionResponse.from(updateCustomerName(session, command.customerName())))
        .orElseGet(
            () ->
                ChatSessionResponse.from(
                    createSession(
                        command.workspaceId(), command.userId(), command.customerName())));
  }

  @Transactional
  public ChatSessionResponse createSession(GetOrCreateCurrentSessionCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    return ChatSessionResponse.from(
        createSession(command.workspaceId(), command.userId(), command.customerName()));
  }

  private void validateWorkspaceMembership(Long workspaceId, Long userId) {
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));
  }

  private ChatSession createSession(Long workspaceId, Long userId, String customerName) {
    DomainPackVersion version =
        domainPackVersionRepository
            .findCurrentPublishedByWorkspaceId(workspaceId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "DOMAIN_PACK_CURRENT_VERSION_NOT_FOUND",
                        "현재 운영 중인 PUBLISHED version을 찾을 수 없습니다. workspaceId=" + workspaceId));

    ChatSession session =
        ChatSession.create(
            workspaceId,
            version.getId(),
            ChatSessionStatus.OPEN,
            DEFAULT_CHANNEL,
            createMetaJson(customerName),
            userId);
    ChatSession saved = chatSessionRepository.save(session);
    eventPublisher.publishEvent(
        new ConsultationQueueChangedEvent(
            workspaceId, saved.getId(), ConsultationQueueEventType.SESSION_UPSERTED));
    return saved;
  }

  private ChatSession updateCustomerName(ChatSession session, String customerName) {
    String nextMetaJson = mergeCustomerName(session.getMetaJson(), customerName);
    if (!nextMetaJson.equals(session.getMetaJson())) {
      session.updateMetaJson(nextMetaJson);
    }
    return session;
  }

  private String createMetaJson(String customerName) {
    try {
      return objectMapper.writeValueAsString(Map.of("customerName", customerName));
    } catch (JsonProcessingException e) {
      throw new BadRequestException("VALIDATION_ERROR", "customerName is invalid", e);
    }
  }

  private String mergeCustomerName(String currentMetaJson, String customerName) {
    try {
      JsonNode current =
          currentMetaJson == null || currentMetaJson.isBlank()
              ? objectMapper.createObjectNode()
              : objectMapper.readTree(currentMetaJson);
      ObjectNode next =
          current != null && current.isObject()
              ? ((ObjectNode) current).deepCopy()
              : objectMapper.createObjectNode();
      next.put("customerName", customerName);
      return objectMapper.writeValueAsString(next);
    } catch (JsonProcessingException e) {
      throw new BadRequestException("VALIDATION_ERROR", "metaJson is invalid", e);
    }
  }
}
